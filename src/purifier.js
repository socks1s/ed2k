/**
 * ED2K Link Purifier
 * A utility to extract, clean, and validate eDonkey2000 links from text.
 */

// State management for statistics
const stats = {
    total: 0,
    valid: 0,
    invalid: 0,
    fixed: 0,
    reset() {
        this.total = 0;
        this.valid = 0;
        this.invalid = 0;
        this.fixed = 0;
    }
};

// DOM Elements
const elements = {
    input: null,
    output: null,
    statsDiv: null,
    validCount: null,
    invalidCount: null,
    fixedCount: null,
    totalCount: null,
    toast: null,
    
    init() {
        this.input = document.getElementById('inputText');
        this.output = document.getElementById('outputText');
        this.statsDiv = document.getElementById('stats');
        this.validCount = document.getElementById('validCount');
        this.invalidCount = document.getElementById('invalidCount');
        this.fixedCount = document.getElementById('fixedCount');
        this.totalCount = document.getElementById('totalCount');
        this.toast = document.getElementById('toast');
        
        // Bind events
        this.input?.addEventListener('input', () => autoResize(this.input));
        document.addEventListener('keydown', handleKeydown);
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    elements.init();
    // Bind global functions to window for HTML onclick attributes
    window.purifyLinks = purifyLinks;
    window.clearAll = clearAll;
    window.copyOutput = copyOutput;
});

/**
 * Main function to process input text
 */
function purifyLinks() {
    const inputText = elements.input.value;
    
    if (!inputText.trim()) {
        showToast('请先输入包含ed2k链接的文本！', 'warning');
        return;
    }
    
    stats.reset();
    const result = processText(inputText);
    
    elements.output.value = result.join('\n');
    updateStatsUI();
    elements.output.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Process text to extract and purify links
 * @param {string} text - Raw input text
 * @returns {string[]} - Array of unique valid links
 */
function processText(text) {
    const validLinksSet = new Set();
    const lines = text.split('\n');
    
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        const potentialLinks = extractPotentialLinks(line);
        
        if (potentialLinks.length === 0) {
            // If line has content but no links found, count as invalid attempt?
            // Current logic only counts extracted candidates that fail validation
            continue; 
        }

        for (const rawLink of potentialLinks) {
            stats.total++;
            const { link, isValid, wasFixed } = purifyLink(rawLink);
            
            if (isValid) {
                if (!validLinksSet.has(link)) {
                    validLinksSet.add(link);
                    stats.valid++;
                    if (wasFixed) stats.fixed++;
                } else {
                    // Duplicate valid link, we might want to count it or ignore
                    // For now, we don't increment valid count for duplicates
                }
            } else {
                stats.invalid++;
            }
        }
    }
    
    return Array.from(validLinksSet);
}

/**
 * Extract potential ED2K links using various patterns
 * @param {string} text - Single line of text
 * @returns {string[]} - Array of potential link strings
 */
function extractPotentialLinks(text) {
    const links = [];
    
    // Regex patterns
    const patterns = [
        // HTML tags
        /<[^>]*>(ed2k[^<]*)<\/[^>]*>/gi,
        // URL Encoded
        /ed2k[^:]*:%[0-9A-F]{2}[^\s<>]*/gi,
        // Standard (including dirty variants)
        /ed2k[^:]*:\/\/[^\s<>]+/gi,
        // Fuzzy protocol (e删d2k etc) - allows up to 20 chars between letters
        /e[^\s<>]{0,20}d[^\s<>]{0,20}2[^\s<>]{0,20}k[^\s<>]*:\/\/[^\s<>]+/gi,
        // Generic protocol with |file|
        /[^\s<>]*:\/\/[\s]*\|file\|[^\s<>]*/gi,
        // Partial link starting with |file|
        /ed2k[^\s<>]*\|file\|[^\s<>]*/gi
    ];

    for (const pattern of patterns) {
        let match;
        // Reset lastIndex for global regex if reused (though we create new ones here)
        while ((match = pattern.exec(text)) !== null) {
            const candidate = match[0] || match[1]; // match[1] for capturing groups
            // Avoid adding substrings of already found links
            if (!links.some(l => l.includes(candidate) || candidate.includes(l))) {
                links.push(candidate);
            }
        }
    }
    
    return links;
}

/**
 * Clean and validate a single link
 * @param {string} link - Raw link string
 * @returns {Object} - { link, isValid, wasFixed }
 */
function purifyLink(link) {
    let currentLink = link;
    const originalLink = link;
    let wasFixed = false;
    
    // 1. Remove HTML tags
    if (/<[^>]*>/.test(currentLink)) {
        currentLink = currentLink.replace(/<[^>]*>/g, '');
        wasFixed = true;
    }

    // 2. URL Decode if needed
    if (currentLink.includes('%')) {
        try {
            // Only decode if it looks like it has encoded chars
            const decoded = decodeURIComponent(currentLink);
            if (decoded !== currentLink) {
                currentLink = decoded;
                wasFixed = true;
            }
        } catch (e) {
            console.warn('Failed to decode URI:', currentLink);
        }
    }

    // 3. Clean Protocol Prefix (remove CJK and other noise)
    const cleanPrefixResult = cleanProtocolPrefix(currentLink);
    if (cleanPrefixResult !== currentLink) {
        currentLink = cleanPrefixResult;
        wasFixed = true;
    }

    // 4. Normalize Protocol
    if (!currentLink.startsWith('ed2k://')) {
        currentLink = currentLink.replace(/^[^:]*:\/\/+/, 'ed2k://');
        wasFixed = true;
    }

    // 5. Clean spaces before |file|
    const pipeIndex = currentLink.indexOf('|');
    if (pipeIndex > -1) {
        const prefix = currentLink.slice(0, pipeIndex);
        if (/\s/.test(prefix)) {
            currentLink = prefix.replace(/\s+/g, '') + currentLink.slice(pipeIndex);
            wasFixed = true;
        }
    }

    // 6. Ensure trailing slash
    if (!currentLink.endsWith('/') && currentLink.includes('|file|')) {
        currentLink += '/';
        wasFixed = true;
    }

    // 7. Trim whitespace
    const trimmed = currentLink.trim();
    if (trimmed !== currentLink) {
        currentLink = trimmed;
        wasFixed = true;
    }
    
    // 8. Clean filename (remove control chars/invalid path chars if needed)
    // Note: ED2K filenames can contain many chars, but we should strip non-printables
    // currentLink = cleanFilename(currentLink);

    return {
        link: currentLink,
        isValid: validateEd2kLink(currentLink),
        wasFixed: wasFixed || (originalLink !== currentLink)
    };
}

/**
 * Remove CJK and noise from the protocol part of the link
 */
function cleanProtocolPrefix(link) {
    const idx = link.indexOf('://');
    if (idx === -1) return link;
    
    const afterProto = idx + 3;
    const firstPipe = link.indexOf('|', afterProto);
    const end = firstPipe !== -1 ? firstPipe : afterProto;
    
    // Regex to match CJK characters and other noise
    // Range: CJK Unified Ideographs, Extended A/B, Compatibility, etc.
    const noiseRegex = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\s]/g;
    
    const prefix = link.slice(0, end).replace(noiseRegex, '');
    return prefix + link.slice(end);
}

/**
 * Validate ED2K link format strictly
 */
function validateEd2kLink(link) {
    // Format: ed2k://|file|filename|size|hash|...|/
    // Hash is 32 char hex
    // Size is digits
    const ed2kPattern = /^ed2k:\/\/\|file\|[^|]+\|\d+\|[A-F0-9]{32}\|.*\|?\/?$/i;
    return ed2kPattern.test(link);
}

// UI Helper Functions

function updateStatsUI() {
    if (elements.statsDiv) {
        elements.validCount.textContent = stats.valid;
        elements.invalidCount.textContent = stats.invalid;
        elements.fixedCount.textContent = stats.fixed;
        if (elements.totalCount) elements.totalCount.textContent = stats.total;
        elements.statsDiv.style.display = 'block';
    }
}

function clearAll() {
    if (elements.input) elements.input.value = '';
    if (elements.output) elements.output.value = '';
    if (elements.statsDiv) elements.statsDiv.style.display = 'none';
    stats.reset();
}

function copyOutput() {
    if (!elements.output || !elements.output.value.trim()) {
        showToast('没有可复制的内容！请先净化链接。', 'warning');
        return;
    }
    
    const text = elements.output.value;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => showToast('✅ 已复制', 'success'))
            .catch(() => fallbackCopy(elements.output));
    } else {
        fallbackCopy(elements.output);
    }
}

function fallbackCopy(textarea) {
    textarea.select();
    try {
        document.execCommand('copy');
        showToast('✅ 已复制', 'success');
    } catch (err) {
        showToast('复制失败，请手动复制', 'error');
    }
}

function showToast(message, type = 'success') {
    if (!elements.toast) return;
    
    // Reset classes
    elements.toast.className = 'toast';
    elements.toast.classList.add(type);
    
    elements.toast.textContent = message;
    elements.toast.style.display = 'flex'; // Flex for alignment
    
    // Trigger reflow
    elements.toast.offsetHeight; 
    elements.toast.classList.add('show');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
        setTimeout(() => {
            elements.toast.style.display = 'none';
        }, 300);
    }, 2000);
}

function autoResize(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 500) + 'px';
}

function handleKeydown(e) {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key.toLowerCase()) {
            case 'enter':
                e.preventDefault();
                purifyLinks();
                break;
            case 'r':
                e.preventDefault();
                clearAll();
                break;
        }
    }
}
