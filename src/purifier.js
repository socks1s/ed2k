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
    duplicates: 0,
    failedLinks: [],
    reset() {
        this.total = 0;
        this.valid = 0;
        this.invalid = 0;
        this.fixed = 0;
        this.duplicates = 0;
        this.failedLinks = [];
    }
};

// Keep track of last known valid count to calculate diff
let lastValidCount = 0;
let lastInvalidCount = 0; // Track invalid count for diffing
let lastDuplicateCount = 0; // Track duplicate count for diffing

// Debounce timer
let debounceTimer = null;

// DOM Elements
const elements = {
    input: null,
    output: null,
    failedOutput: null,
    failedSection: null,
    statsDiv: null,
    validCount: null,
    invalidCount: null,
    fixedCount: null,
    duplicateCount: null,
    totalCount: null,
    toastContainer: null,
    copyBtn: null,
    
    init() {
        this.input = document.getElementById('inputText');
        this.output = document.getElementById('outputText');
        this.failedOutput = document.getElementById('failedText');
        this.failedSection = document.getElementById('failedSection');
        this.statsDiv = document.getElementById('stats');
        this.validCount = document.getElementById('validCount');
        this.invalidCount = document.getElementById('invalidCount');
        this.fixedCount = document.getElementById('fixedCount');
        this.duplicateCount = document.getElementById('duplicateCount');
        this.totalCount = document.getElementById('totalCount');
        this.toastContainer = document.getElementById('toast-container');
        this.copyBtn = document.getElementById('copyBtn');
        
        // Bind events
        // Removed autoResize binding to keep height fixed
        document.addEventListener('keydown', handleKeydown);
        
        // Auto-append newline on blur/hidden and keep scroll at bottom with padding
        const ensureTrailingNewlineAndScroll = () => {
            const input = this.input;
            if (!input) return;
            
            const val = input.value;
            let changed = false;
            
            // 1. Ensure newline
            if (val && !val.endsWith('\n')) {
                input.value = val + '\n';
                changed = true;
            }
            
            // 2. Ensure empty lines buffer at bottom (add extra newlines if needed for visual padding)
            // Actually user just wants visual space and scroll to bottom.
            // Adding actual newlines changes data which might be annoying if they want to edit previous line.
            // But "始终需要有几行是空的" implies adding newlines or just scrolling past end?
            // If we scroll past end, we need content to scroll to.
            // Let's try to just ensure 2 extra newlines at the end for buffer if not present?
            // Or better: Just scroll to bottom.
            
            // "自动将进度条拉到最底下"
            input.scrollTop = input.scrollHeight;
        };

        this.input.addEventListener('blur', ensureTrailingNewlineAndScroll);
        window.addEventListener('blur', ensureTrailingNewlineAndScroll);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                ensureTrailingNewlineAndScroll();
            }
        });
        
        // Also scroll on input to keep cursor in view if at bottom
        this.input.addEventListener('input', () => {
             // If near bottom, keep at bottom? 
             // Or just rely on browser default behavior for typing.
             // User request: "即使文字满了，也需要自动将进度条拉到最底下"
             // This usually implies when *appending* programmatically or pasting.
             // But "光标保持在最下面" implies standard behavior.
             
             // The request: "最底下始终需要有几行是空的"
             // We can achieve this by adding padding-bottom to the textarea via CSS?
             // But that doesn't move the cursor.
             // If we add actual newlines, it affects the value.
             // Let's assume adding actual newlines is acceptable given the context of "batch pasting".
             
             const input = this.input;
             const val = input.value;
             if (val.length > 0 && !val.endsWith('\n\n\n')) {
                 // Check if we are at the end? No, user wants buffer.
                 // Let's not be too aggressive on 'input' event as it interrupts typing.
             }
        });
        
        // Add a specific handler for the "empty lines at bottom" requirement
        // We can use CSS padding-bottom for the visual "empty lines" effect without modifying value
        this.input.style.paddingBottom = "50px"; // Reserve space at bottom
        
        // Ensure scroll stays at bottom when new content is added/focused
        const keepScrollAtBottom = () => {
             if (document.activeElement === this.input) {
                 // If user is typing, we might not want to force scroll unless they are at end?
                 // But if they append text (paste), browser handles it.
                 // The main issue is when text fills up, the bottom line is right at the border.
                 // The padding-bottom fixes the "blocked by border" issue.
                 
                 // "自动将进度条拉到最底下" -> Force scroll to bottom on blur/paste
                 this.input.scrollTop = this.input.scrollHeight;
             }
        };
        
        // Enhance the ensureTrailingNewline to also scroll
        const enhancedEnsure = () => {
            ensureTrailingNewlineAndScroll();
            // Double check scroll after layout update
            requestAnimationFrame(() => {
                this.input.scrollTop = this.input.scrollHeight;
            });
        };
        
        this.input.addEventListener('blur', enhancedEnsure);
        window.addEventListener('blur', enhancedEnsure);
        // On focus, if at end, ensure scroll
        this.input.addEventListener('focus', () => {
             if (this.input.selectionStart === this.input.value.length) {
                 this.input.scrollTop = this.input.scrollHeight;
             }
        });
        
        // Auto-purify on input and save to localStorage
        this.input.addEventListener('input', () => {
            // Save to local storage
            localStorage.setItem('ed2k_purifier_input', this.input.value);
            
            // Debounce logic
            if (debounceTimer) clearTimeout(debounceTimer);
            
            debounceTimer = setTimeout(() => {
                purifyLinks(true); // Pass true to show diff toast
            }, 500); // 500ms debounce
        });
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    elements.init();
    // Bind global functions to window for HTML onclick attributes
    window.purifyLinks = purifyLinks;
    window.clearAll = clearAll;
    window.copyOutput = copyOutput;
    
    // Load from local storage if available
    const savedInput = localStorage.getItem('ed2k_purifier_input');
    if (savedInput) {
        elements.input.value = savedInput;
        showToast('已恢复上次未完成的输入', 'success');
    }

    // Initial check if there is content (e.g. browser restore or local storage)
    if (elements.input && elements.input.value.trim()) {
        purifyLinks(false); // No toast on initial load
        // Initialize baseline after first load
        lastValidCount = stats.valid;
        lastInvalidCount = stats.invalid;
        lastDuplicateCount = stats.duplicates;
    }
});

/**
 * Main function to process input text
 * @param {boolean} showDiffToast - Whether to show toast based on result diff
 */
function purifyLinks(showDiffToast = true) {
    const inputText = elements.input.value;
    
    if (!inputText.trim()) {
        // If empty, just clear output
        elements.output.value = '';
        stats.reset();
        lastValidCount = 0; // Reset baseline
        lastInvalidCount = 0;
        lastDuplicateCount = 0;
        updateStatsUI();
        if (elements.failedSection) elements.failedSection.style.display = 'none';
        if (elements.copyBtn) elements.copyBtn.disabled = true;
        return;
    }
    
    stats.reset();
    const result = processText(inputText);
    
    elements.output.value = result.join('\n');
    
    // Enable copy button if there are results
    if (elements.copyBtn) {
        elements.copyBtn.disabled = result.length === 0;
    }
    
    // Handle failed links display
    if (stats.failedLinks.length > 0) {
        if (elements.failedSection) elements.failedSection.style.display = 'block';
        if (elements.failedOutput) elements.failedOutput.value = stats.failedLinks.join('\n');
    } else {
        if (elements.failedSection) elements.failedSection.style.display = 'none';
        if (elements.failedOutput) elements.failedOutput.value = '';
    }
    
    updateStatsUI();
    
    // Calculate diff
    const newValidCount = stats.valid;
    const newInvalidCount = stats.invalid;
    const newDuplicateCount = stats.duplicates;
    
    const addedCount = newValidCount - lastValidCount;
    const failedDiff = newInvalidCount - lastInvalidCount;
    const duplicateDiff = newDuplicateCount - lastDuplicateCount;
    
    if (showDiffToast) {
         // Case 1: Only failures added -> RED (Error)
         if (failedDiff > 0 && addedCount === 0 && duplicateDiff === 0) {
             showToast(`解析失败 ${failedDiff} 条链接`, 'error');
         }
         // Case 2: Only duplicates added -> ORANGE (Warning)
         else if (duplicateDiff > 0 && addedCount === 0 && failedDiff === 0) {
             showToast(`检测到 ${duplicateDiff} 条重复链接`, 'warning');
         }
         // Case 3: Mixed results or only successes
         else if (addedCount > 0 || failedDiff > 0 || duplicateDiff > 0) {
             // Priority: If ANY failure -> RED/ORANGE (Warning)
             // If NO failure but has duplicates -> ORANGE (Warning)
             // If ONLY success -> GREEN (Success)
             
             let parts = [];
             if (addedCount > 0) parts.push(`成功 ${addedCount}`);
             if (failedDiff > 0) parts.push(`失败 ${failedDiff}`);
             if (duplicateDiff > 0) parts.push(`重复 ${duplicateDiff}`);
             
             const msg = parts.join('，');
             
             if (failedDiff > 0) {
                 // If there are failures, treat as error/warning
                 showToast(msg, 'error'); 
             } else if (duplicateDiff > 0) {
                 // No failures but has duplicates, treat as warning
                 showToast(msg, 'warning');
             } else {
                 // Only successes
                 showToast(msg, 'success');
             }
         }
         // Case 4: No changes, do nothing
    }
    
    // Update baseline for next run
    lastValidCount = newValidCount;
    lastInvalidCount = newInvalidCount;
    lastDuplicateCount = newDuplicateCount;
}

/**
 * Process text to extract and purify links
 * @param {string} text - Raw input text
 * @returns {string[]} - Array of unique valid links
 */
function processText(text) {
    const validLinksSet = new Set();
    
    // Pre-process text to fix broken protocol prefixes caused by newlines
    // Matches e, d, 2, k separated by whitespace/newlines, and ://
    let preProcessedText = text.replace(/e\s*d\s*2\s*k\s*:\s*\/\s*\//gim, (match) => {
        if (/\n|\r/.test(match)) {
            return 'ed2k://';
        }
        return match;
    });
    
    // Pre-process: Separate concatenated links (e.g. ...|/ed2k://...)
    // Look for patterns where a link seems to end and another immediately starts
    // Common end pattern is |/ (standard) or just | followed by ed2k
    preProcessedText = preProcessedText.replace(/\|\/(ed2k:)/gi, '|/\n$1');
    
    // Also handle URL encoded version: %7C/ed2k... -> %7C/ \n ed2k...
    // %7C is |
    preProcessedText = preProcessedText.replace(/%7C\/(ed2k:)/gi, '%7C/\n$1');
    
    // Handle case where links are separated only by | (without slash)
    // e.g. ...|hash|ed2k://...
    preProcessedText = preProcessedText.replace(/\|(ed2k:)/gi, '|\n$1');
    preProcessedText = preProcessedText.replace(/%7C(ed2k:)/gi, '%7C\n$1');

    const lines = preProcessedText.split('\n');
    
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
                    // Duplicate valid link
                    stats.duplicates++;
                }
            } else {
                stats.invalid++;
                stats.failedLinks.push(rawLink);
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
        // Standard (including dirty variants) - now allowing spaces if they are part of filename structure
        // We match until the end of the ed2k link structure which usually ends with |/
        /ed2k[^:]*:\/\/[^\n\r<>]+/gi,
        // Fuzzy protocol (e删d2k etc) - allows up to 20 chars between letters
        /e[^\s<>]{0,20}d[^\s<>]{0,20}2[^\s<>]{0,20}k[^\s<>]*:\/\/[^\n\r<>]+/gi,
        // Generic protocol with |file|
        // We need to allow spaces in the filename part.
        // The pattern should match `anything://` + `|file|` + `...`
        // But we need to be careful not to match too much.
        // Let's try to match until a pipe followed by slash `|/` which is typical end of ed2k
        // Or just be more permissive with characters after |file|
        /[^\s<>]*:\/\/[\s]*\|file\|[^\n\r<>]*/gi,
        
        // Partial link starting with |file| - Enhanced to catch cases with spaces or brackets before
        /(?:^|[\s<>\[\(])ed2k[^\s<>]*\|file\|[^\n\r<>]*/gi,
        // Fallback: try to match |file|...|/ pattern even if protocol is missing or broken
        /\|file\|[^|]+\|\d+\|[A-F0-9]{32}\|.*\|?\/?/gi
    ];

    for (const pattern of patterns) {
        let match;
        // Reset lastIndex for global regex if reused (though we create new ones here)
        while ((match = pattern.exec(text)) !== null) {
            const candidate = match[0] || match[1]; // match[1] for capturing groups
            
            // Check if we already have a longer version of this link
            const existingIndex = links.findIndex(l => l.includes(candidate));
            if (existingIndex !== -1) {
                // Already have a longer or equal version, ignore this candidate
                continue;
            }
            
            // Check if this candidate is a longer version of an existing link
            const subStringIndex = links.findIndex(l => candidate.includes(l));
            if (subStringIndex !== -1) {
                // This candidate is longer/better, replace the existing one
                links[subStringIndex] = candidate;
                continue;
            }
            
            // No overlap found, add as new
            links.push(candidate);
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
            // Try to decode multiple times if needed (though usually once is enough unless double encoded)
            // But first, let's be careful not to break things that shouldn't be decoded if mixed.
            // However, for ed2k links, usually the whole thing or filename is encoded.
            const decoded = decodeURIComponent(currentLink);
            if (decoded !== currentLink) {
                currentLink = decoded;
                wasFixed = true;
            }
        } catch (e) {
            console.warn('Failed to decode URI:', currentLink);
        }
    }

    // Special case: If the link contains spaces in the protocol part (e.g. "[KO deep] ...")
    // The regex extraction might have grabbed "[KO deep] " as part of the start if we are not careful,
    // OR, more likely, the extraction regex for fuzzy match `ed2k...` might not have triggered 
    // if the start is completely messed up like `[KO deep] ed2k://...` -> Wait, if it is `ed2k://` it should be fine.
    // Let's look at the failing case: `ed2k://|file|[KO deep] ...`
    // If `[KO deep]` is part of the filename, it should be fine.
    // But wait, if the input was `ed2k://|file|[KO deep] ...` 
    // The issue might be `cleanProtocolPrefix` removing things it shouldn't?
    // No, `cleanProtocolPrefix` only touches things BEFORE `|`.
    // Let's look at the failed link from logs: `ed2k://|file|[KO`
    // It seems truncated! 
    // Ah, the regex `ed2k[^:]*:\/\/[^\s<>]+` matches until whitespace!
    // If the filename contains spaces (which is valid in ed2k logical filenames, but often encoded), 
    // the regex stops at the space.
    // We need to adjust the regex to allow spaces in the filename part if it's within the |file|...| structure.
    
    // No change here in purifyLink, but we need to fix extractPotentialLinks regex.


    // 3. Clean Protocol Prefix (remove CJK and other noise)
    // Also handle cases where CJK is mixed with protocol characters (e.g. ed删2k)
    // or inserted between protocol and file separator (e.g. ed2k:删除//)
    
    // First, ensure protocol is standard ed2k:// if it looks like one
    // This regex looks for variations of 'ed2k' followed by '://' with potential noise
    // or patterns like `ed2k:/` followed by non-ascii then `/`
    if (/^e[^:]*k[^:]*:\/\//i.test(currentLink) || /^ed2k:[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]+\/\//i.test(currentLink) || /^ed2k:\/[^\/]+\//i.test(currentLink)) {
        // Try to identify the part before |file|
        const pipeIndex = currentLink.indexOf('|');
        if (pipeIndex > -1) {
            // We found a pipe, assume everything before it is the protocol/prefix section
            // Replace the start (up to |file|) with ed2k:// if it contains patterns like "ed2k" or "file"
            // But wait, we need to preserve `|file|`
            // Let's find the first occurrence of `|file|`
            const filePartIndex = currentLink.indexOf('|file|');
            if (filePartIndex > -1) {
                // Everything before |file| is considered the dirty protocol
                currentLink = 'ed2k://' + currentLink.slice(filePartIndex);
                wasFixed = true;
            } else {
                // Maybe it's just `|` without `file` (rare for valid links but possible in fragments)
                // Fallback to cleaning chars
                const cleanPrefixResult = cleanProtocolPrefix(currentLink);
                if (cleanPrefixResult !== currentLink) {
                    currentLink = cleanPrefixResult;
                    wasFixed = true;
                }
            }
        }
    } else {
        const cleanPrefixResult = cleanProtocolPrefix(currentLink);
        if (cleanPrefixResult !== currentLink) {
            currentLink = cleanPrefixResult;
            wasFixed = true;
        }
    }

    // 4. Normalize Protocol
    if (!currentLink.startsWith('ed2k://')) {
        // If it starts with |file|, prepend ed2k://
        if (currentLink.startsWith('|file|')) {
            currentLink = 'ed2k://' + currentLink;
        } else {
            currentLink = currentLink.replace(/^[^:]*:\/\/+/, 'ed2k://');
        }
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
    // Added \uFF00-\uFFEF for Halfwidth and Fullwidth Forms (includes full-width parens （）)
    const noiseRegex = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\s]/g;
    
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
        if (elements.validCount) elements.validCount.textContent = stats.valid;
        if (elements.invalidCount) elements.invalidCount.textContent = stats.invalid;
        // fixedCount is removed from HTML but kept in logic if needed later, ignore UI update for it if element missing
        if (elements.fixedCount) elements.fixedCount.textContent = stats.fixed;
        if (elements.duplicateCount) elements.duplicateCount.textContent = stats.duplicates;
        if (elements.totalCount) elements.totalCount.textContent = stats.total;
        
        // Dynamic class switching based on results
        elements.statsDiv.className = 'stats-bar'; // Reset to base class
        
        if (stats.total > 0) {
            if (stats.valid > 0 && stats.invalid === 0) {
                elements.statsDiv.classList.add('success');
            } else if (stats.valid > 0 && stats.invalid > 0) {
                elements.statsDiv.classList.add('warning');
            } else if (stats.valid === 0) {
                elements.statsDiv.classList.add('error');
            }
        }
        // If total is 0, it stays default gray
    }
}

function clearAll() {
    if (elements.input) elements.input.value = '';
    if (elements.output) elements.output.value = '';
    // Clear local storage
    localStorage.removeItem('ed2k_purifier_input');
    
    // if (elements.statsDiv) elements.statsDiv.style.display = 'none'; // Keep visible
    stats.reset();
    updateStatsUI(); // Reset stats to 0
    
    // Also clear failed section
    if (elements.failedSection) elements.failedSection.style.display = 'none';
    if (elements.failedOutput) elements.failedOutput.value = '';

    // Disable copy button
    if (elements.copyBtn) elements.copyBtn.disabled = true;
}

async function copyOutput() {
    const text = elements.output.value;
    // Double check content exists (though button should be disabled)
    if (!text.trim()) {
        showToast('没有可复制的内容！', 'warning');
        return;
    }

    const success = await copyTextToClipboard(text);
    if (success) {
        showToast('已复制', 'success');
    } else {
        showToast('复制失败，请手动复制', 'error');
    }
}

/**
 * Robust copy to clipboard function
 * Tries Modern API first, then fallbacks to legacy method
 * @param {string} text 
 * @returns {Promise<boolean>} success
 */
async function copyTextToClipboard(text) {
    // 1. Try Modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.warn('Clipboard API failed, trying fallback...', err);
        }
    }

    // 2. Fallback: document.execCommand('copy')
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Ensure element is part of DOM but not disruptive
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        textArea.setAttribute('readonly', ''); // Prevent keyboard popping up on mobile
        document.body.appendChild(textArea);
        
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
    } catch (err) {
        console.error('Fallback copy failed:', err);
        return false;
    }
}

function showToast(message, type = 'success') {
    if (!elements.toastContainer) return;
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Create icon element
    const icon = document.createElement('div');
    icon.className = `toast-icon icon-${type}`;
    
    // Create text node
    const text = document.createTextNode(message.replace(/^[✅⚠️❌]\s*/, '')); // Strip existing emojis if any
    
    // Append content
    toast.appendChild(icon);
    toast.appendChild(text);
    
    // Append to container
    elements.toastContainer.appendChild(toast);
    
    // Trigger reflow for animation
    toast.offsetHeight; 
    
    // Show animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    // Remove after timeout
    setTimeout(() => {
        toast.classList.remove('show');
        // Wait for transition to finish before removing element
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 400); // Match transition duration
    }, 3000); // Increased duration slightly for better readability
}

// Removed autoResize function as fixed height is required
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
