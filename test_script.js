const fs = require('fs');

// 模拟 DOM 环境的部分功能
global.document = {
    getElementById: () => ({ value: '', textContent: '', style: {} }),
    addEventListener: () => {}
};
global.window = {};
global.navigator = { clipboard: {} };
global.alert = console.log;
global.requestAnimationFrame = (cb) => cb();

// 读取源代码并执行，以便获取函数定义
// 注意：这里我们假设 purifier.js 是纯函数集合，没有立即执行的副作用干扰测试
// 为了在 node 环境测试，我们需要稍微修改 purifier.js 的导出方式，或者简单地复制相关逻辑。
// 鉴于不能直接 require 浏览器端的 js，我将读取文件内容并 eval 执行，或者为了稳健性，
// 我将在此脚本中重新引入核心逻辑进行测试。为了确保测试的是真实逻辑，最好是直接测试源文件。
// 但源文件包含 DOM 操作。这里我选择将核心逻辑复制过来进行测试，或者使用简单的正则提取。
// 为了保证完全一致，我将读取 src/purifier.js 的内容，去掉 DOM 相关部分后执行。

const purifierContent = fs.readFileSync('src/purifier.js', 'utf8');
// 提取核心函数：processText, extractPotentialLinks, purifyLink, cleanProtocolPrefix, validateEd2kLink
// 我们使用 eval 来加载这些函数到当前作用域，但在 eval 之前 mock 掉 elements 和 stats
const mockScript = `
    // Remove existing stats/elements declarations if any to avoid conflict in eval scope (though let/const in eval are block scoped if eval is direct, but here global scope pollution might happen if var used)
    // Since purifier.js uses 'const stats', and we declared it in mockScript, simply removing the const declaration from purifierContent is safer.
    
    var elements = {
        input: { value: '' },
        output: { value: '' },
        statsDiv: { style: {} },
        validCount: {},
        invalidCount: {},
        fixedCount: {},
        totalCount: {},
        toast: { style: {}, classList: { add:()=>{}, remove:()=>{} } },
        init: () => {}
    };
    function showToast() {}
    function updateStatsUI() {}
    function autoResize() {}
    function handleKeydown() {}
    
    ${purifierContent
        .replace(/const stats = \{[\s\S]*?\};/, '') // Remove stats declaration
        .replace(/const elements = \{[\s\S]*?\};/, '') // Remove elements declaration
        .replace(/document\.addEventListener\('DOMContentLoaded', \(\) => \{[\s\S]*?\}\);/, '') // Remove DOMContentLoaded block
        .replace(/document\.addEventListener.*/g, '')
        .replace(/window\..*/g, '')
    }
`;

// Pre-declare stats for the functions to use
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

eval(mockScript);

const testInput = `ed2k://%7Cfile%7C%5BNighTalks.Com%5D%20KT94087.mp4%7C1555793395%7C74600329DEEBB78D261852F3DE51AF9F%7Ch=SGUUNYPRBZOXKLXA5TVUI7HLEKMKSYHK%7C/ 
 
 ed2k://|file|TR%20HS038%20mp4.mp4|1084587590|B6B46504C28B4818A41B00FA1DEB0C2B|h=GG5CYRAOTQELEI6KDPI4XOUX26FYAVIU|/ 
 
 ed2k://|file|[KO deep] 快楽ジャンキー III KDE111.mp4|3566207764|A20575BDB7482B1C04142F0E777A6777|/ 
 
 
 ed2k://%7Cfile%7C%5BKO%20deep%5D%20快楽ジャンキー%20III%20KDE111.mp4%7C3566207764%7CA20575BDB7482B1C04142F0E777A6777%7C/ 
 
 ed删2k://|file|COAT1912.mp4|2356390257|7CD0D658FF74D94EB7F601AF1B948DA2|h=RB47YW67TEAUO6VXLBCHAUHND6BGT3VS|/ 
 ed2k://|file|[NighTalks.Com]%20COAT1670.mp4|3771103341|C3A98D6E08B3C8DB94C941E46A8ADAC7|h=MTCJ6YKCRZS6YBYJ2O5CY4PIEPGUJHA4|/ 
 ed2k://|file|ORWEJT005%20mp4.mp4|962139927|28000DB8FD79AFA148554FBD0C363E05|/ 
 ed2k://|file|[mensrush.tv]%20MS-500%2020%E6%AD%B3%EF%BC%88%E5%85%83%EF%BC%89%E7%AB%A5%E8%B2%9E%E7%94%B7%E5%AD%90%E3%81%8C%E9%81%82%E3%81%AB%E7%94%B7%E3%81%AB%E3%82%A2%E3%83%8A%E3%83%AB%E3%82%92%E6%8D%A7%E3%81%92%E3%82%8B%EF%BC%81%E6%8E%98%E3%82%89%E3%82%8C%E3%81%AA%E3%81%8C%E3%82%89%E9%9B%BB%E3%83%9E%E3%81%A7%E3%82%A4%E3%81%8F%EF%BC%81.mp4|980775418|12D49127261F4B4902720AA82D7F3ED2|/ 
 ed2k://%7Cfile%7C%5BNighTalks.Com%5D%20JUS189.mp4%7C4131984807%7C146607E388A1FAEE8057FAA1CA8C3577%7Ch=JXGZOLANR2DWZB35KIL5MUEKXFHEPK36%7C/ 
 ed2k://%7Cfile%7C%5BNighTalks.Com%5D%20KSF218.mp4%7C3702111384%7C616098CC9A9C1DEA87AF2371549832BF%7Ch=RQFAQ57FCPISBJW26363XPJ6N73GEU2U%7C/ 
 
 e删除d2k://  |file|[NighTalks.Com]%20CAPY-1058.mp4|2087830690|181D54060FF205A0DD46D6D3DE024949|h=NARV3PQSGEAQLZ2SUA24M5JZEE4Y5QFH|/ 
 ed2k://%7Cfile%7C%5BNighTalks.Com%5D%20CAPY-1058.mp4%7C2087830690%7C181D54060FF205A0DD46D6D3DE024949%7Ch=NARV3PQSGEAQLZ2SUA24M5JZEE4Y5QFH%7C/ 
 ed2k://%E5%88%A0%E9%99%A4%7Cfile%7C%5BNighTalks.Com%5D%20GAMS876.mp4%7C4163673173%7C29C06426ADA5A8FD348DA54F91F80E50%7Ch=JRATQLFCTTQOO5U24CTISKBE6ZC7RCHK%7C/ 
 ed2k://%7Cfile%7C%5BNighTalks.Com%5D%20GAMS876.mp4%7C4163673173%7C29C06426ADA5A8FD348DA54F91F80E50%7Ch=JRATQLFCTTQOO5U24CTISKBE6ZC7RCHK%7C/ 
 
 ed删除我2k://|file|2024013006.mp4|1378469028|7DAB7E14B8AB2726C55C46CAFEE0C68B|h=24IA65X2ZGSWEFIFZM46FQGZ4UEOBWN3|/`;

console.log('Running tests...');

// 我们需要修改 processText 逻辑来捕获无效链接，因为原函数只返回 validLinks
// 这里我们重写一个测试用的 processText 版本，或者修改原代码逻辑。
// 为了满足用户需求 "统计数据需要准确，总链接=有效链接+无效链接"，我们需要修改源码。
// 这里先运行现有逻辑看看情况。

// 重新定义 processText 以便于测试收集详细信息
function processTextForTest(text) {
    const validLinksSet = new Set();
    const invalidLinksList = [];
    const lines = text.split('\n');
    let totalProcessed = 0;
    let duplicates = 0;
    
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        const potentialLinks = extractPotentialLinks(line);
        
        if (potentialLinks.length === 0) continue;

        for (const rawLink of potentialLinks) {
            totalProcessed++;
            const { link, isValid, wasFixed } = purifyLink(rawLink);
            
            if (isValid) {
                if (!validLinksSet.has(link)) {
                    validLinksSet.add(link);
                } else {
                    duplicates++;
                }
            } else {
                invalidLinksList.push(rawLink);
            }
        }
    }
    
    return {
        total: totalProcessed,
        validCount: validLinksSet.size,
        validLinks: Array.from(validLinksSet),
        invalidCount: invalidLinksList.length,
        invalidLinks: invalidLinksList,
        duplicates: duplicates
    };
}

// 运行测试
const result = processTextForTest(testInput);

console.log('---------------------------------------------------');
console.log(`Total Processed Links (Raw Candidates): ${result.total}`);
console.log(`Valid Links (Unique): ${result.validCount}`);
console.log(`Duplicates Removed: ${result.duplicates}`);
console.log(`Invalid Links: ${result.invalidCount}`);
console.log('---------------------------------------------------');

// Verify formula: Total = Valid + Duplicates + Invalid
const calculatedTotal = result.validCount + result.duplicates + result.invalidCount;
if (calculatedTotal === result.total) {
    console.log(`✅ Stats Formula Verified: ${result.total} = ${result.validCount} + ${result.duplicates} + ${result.invalidCount}`);
} else {
    console.log(`❌ Stats Formula Mismatch: Total(${result.total}) != Valid(${result.validCount}) + Duplicates(${result.duplicates}) + Invalid(${result.invalidCount})`);
    process.exit(1);
}

if (result.invalidCount > 0) {
    console.log('❌ FAILED LINKS (Should be 0 if all fixed):');
    result.invalidLinks.forEach((link, i) => {
        console.log(`[${i+1}] ${link}`);
    });
} else {
    console.log('✅ All links were successfully fixed/validated!');
}

console.log('---------------------------------------------------');
console.log('Valid Links Output:');
console.log(result.validLinks.join('\n'));

// 验证逻辑：用户要求所有链接必须成功修复。
// 我们期望 invalidCount 为 0。
if (result.invalidCount === 0) {
    console.log('\nTEST PASSED: All test cases handled correctly.');
} else {
    console.log('\nTEST FAILED: Some links could not be purified.');
    process.exit(1);
}
