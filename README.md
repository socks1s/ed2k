# ED2K链接净化器

一个强大的在线工具，用于从混乱的文本中提取并净化ED2K下载链接。

## 🚀 功能特性

- **智能识别**：自动识别各种格式的ED2K链接
- **全面净化**：清理HTML标签、干扰词、URL编码等杂质
- **实时统计**：显示有效链接数、修复数等详细信息
- **一键复制**：方便快速复制净化后的链接
- **用户友好**：简洁美观的界面设计

## 📋 支持的链接格式

- HTML标签包裹的链接：`<p>ed2k://...</p>`
- 包含干扰词的链接：`ed2k删除://...`
- URL编码的链接：`ed2k://%7Cfile%7C...`
- 各种协议变形和格式不规范的链接

## 🎯 使用方法

1. 在输入框中粘贴包含ED2K链接的文本
2. 点击"净化链接"按钮
3. 在输出框中查看清理后的纯净链接
4. 使用"复制结果"按钮一键复制所有链接

## 💡 示例

**输入：**
```
<p>ed2k://|file|example_video.mp4|1234567890|ABC123DEF456789012345678901234567890|/</p>
ed2k删除://|file|sample_file.mp4|9876543210|DEF456ABC789012345678901234567890123|h=XYZABC123DEFGHI456JKLMNO789PQRSTUV|/
ed2k://%7Cfile%7C%20demo_content.mp4%7C1357924680%7CGHI789JKL012345678901234567890ABCDEF%7Ch=MNOPQR456STUVWX789ABCDEF012345GHIJK%7C/
```

**输出：**
```
ed2k://|file|example_video.mp4|1234567890|ABC123DEF456789012345678901234567890|/
ed2k://|file|sample_file.mp4|9876543210|DEF456ABC789012345678901234567890123|h=XYZABC123DEFGHI456JKLMNO789PQRSTUV|/
ed2k://|file| demo_content.mp4|1357924680|GHI789JKL012345678901234567890ABCDEF|h=MNOPQR456STUVWX789ABCDEF012345GHIJK|/
```

## 🛠️ 技术实现

- 纯HTML/CSS/JavaScript实现，无需服务器
- 智能正则表达式匹配和文本处理
- 响应式设计，支持各种设备
- 本地运行，数据安全可靠

## 🚀 快速开始

1. 克隆仓库：
   ```bash
   git clone https://github.com/socks1s/ed2k.git
   ```

2. 在浏览器中打开 `index.html` 文件即可使用

3. 或者使用本地服务器：
   ```bash
   python3 -m http.server 8080
   ```
   然后访问 `http://localhost:8080`

## 📁 项目结构

```
ed2k/
├── index.html               # 主要工具页面
├── README.md                 # 项目说明文档
└── .gitignore               # Git忽略文件
```

## ⌨️ 键盘快捷键

- `Ctrl + Enter`：净化链接
- `Ctrl + R`：清空所有内容

## 📝 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个工具！

---

💡 **提示**：这个工具完全在本地运行，不会上传您的数据到任何服务器，保证隐私安全。
