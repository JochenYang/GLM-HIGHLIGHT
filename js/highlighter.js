// 核心高亮类
class TextHighlighter {
  constructor(options = {}) {
    // 使用统一配置
    this.config = {
      ...window.HighlighterConfig,
      ...options,
    };

    // 合并选项
    this.options = {
      caseSensitive: true, // 修改为 true，支持大小写敏感
      className: this.config.className,
      stylePrefix: this.config.stylePrefix,
      batchSize: this.config.performance.batch.size,
      wordsOnly: false,           // 新增：是否只匹配完整单词
      wordsBoundary: '\\b',       // 新增：单词边界正则
      ignoreDiacritics: false,    // 新增：是否忽略变音符号
      highlightCallback: null,    // 新增：高亮回调函数
      ...options,
    };

    // 实现 LRU 缓存
    this.MAX_PATTERN_CACHE = this.config.performance.batch.maxNodes || 1000;
    this.nodeStates = new WeakMap();
    this.patternCache = new Map();
    this.patternCacheOrder = [];

    // 初始化 DOM 片段缓存
    this.fragmentCache = new WeakMap();
  }

  _setupCacheCleanup() {
    // 使用 LRU 缓存策略
    const cleanupCache = () => {
      while (this.patternCache.size > this.MAX_PATTERN_CACHE) {
        const oldestKey = this.patternCacheOrder.shift();
        this.patternCache.delete(oldestKey);
      }
      
      // 定期清理无效的fragmentCache引用
      if (this.fragmentCache instanceof WeakMap) {
        // WeakMap会自动清理失去引用的对象，无需手动清理
        // 但我们可以通过重新创建来确保内存使用最优
        if (Math.random() < 0.1) { // 10%概率执行完全重置
          this.fragmentCache = new WeakMap();
        }
      }
    };

    // 定期清理
    setInterval(cleanupCache, 10000); // 每10秒检查一次，比原来更频繁
  }

  clearCache() {
    this.nodeStates = new WeakMap();
    this.patternCache.clear();
    this.patternCacheOrder = [];
    this.fragmentCache = new WeakMap();
  }

  // 修改文本节点合并逻辑
  _mergeTextNodes(node) {
    if (!node || !node.parentNode) return;

    // 处理前后文本节点
    if (
      node.previousSibling &&
      node.previousSibling.nodeType === Node.TEXT_NODE
    ) {
      node.previousSibling.nodeValue =
        node.previousSibling.nodeValue + (node.nodeValue || node.textContent);
      if (node.nextSibling && node.nextSibling.nodeType === Node.TEXT_NODE) {
        node.previousSibling.nodeValue += node.nextSibling.nodeValue;
        node.nextSibling.remove();
      }
      node.remove();
    } else if (
      node.nextSibling &&
      node.nextSibling.nodeType === Node.TEXT_NODE
    ) {
      node.nextSibling.nodeValue =
        (node.nodeValue || node.textContent) + node.nextSibling.nodeValue;
      node.remove();
    }
  }

  // 优化批处理机制
  processBatch(nodes, processor) {
    let processed = 0;
    const processNextBatch = () => {
      const batchSize = this.config.performance.batch.size;
      const end = Math.min(processed + batchSize, nodes.length);

      for (let i = processed; i < end; i++) {
        processor(nodes[i]);
      }

      processed = end;

      if (processed < nodes.length) {
        requestAnimationFrame(processNextBatch);
      }
    };

    if (nodes.length > 0) {
      processNextBatch();
    }
  }

  // 简化的节点跳过逻辑，避免重复检查
  shouldSkipNode(node) {
    // 直接使用Utils.dom中的统一检查逻辑
    return Utils.dom.shouldSkipNode(node, this.config);
  }

  // 高亮主函数
  highlight(node, keywords) {
    if (!node || !keywords?.length) return;

    try {
      // 一次性收集所有文本节点
      const textNodes = this._collectTextNodes(node);

      // 批量处理节点但没有分片
      textNodes.forEach((textNode) => {
        this._processTextNode(textNode, keywords);
      });
    } catch (error) {
      Utils.handleError(error, "highlight");
    }
  }

  // 优化的文本节点收集
  _collectTextNodes(container) {
    if (!container || !(container instanceof Node)) return [];

    const textNodes = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (this.shouldSkipNode(node)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    return textNodes;
  }

  _processTextNodesBatch(nodes) {
    // 批量处理文本节点
    nodes.forEach((node) => {
      if (!this.nodeStates.has(node)) {
        this.nodeStates.set(node, true);
      }
    });
  }

  // 预处理关键词
  _preprocessKeywords(keywords) {
    return keywords
      .filter(
        (item) =>
          item?.words && typeof item.words === "string" && item.words.trim()
      )
      .map((item) => {
        const processed = {
          ...item,
          words: item.words.trim(),
          // 使用 WeakRef 包装正则对象
          pattern: new WeakRef(this._getSearchPattern(item.words)),
          length: item.words.length,
        };
        return processed;
      })
      .sort((a, b) => b.length - a.length);
  }

  // 获取或创建搜索正则
  _getSearchPattern(keyword) {
    if (!keyword) return null;

    // 处理变音符号
    let processedKeyword = keyword;
    if (this.options.ignoreDiacritics) {
      processedKeyword = this._removeDiacritics(keyword);
    }

    // 使用关键词和选项作为缓存键
    const cacheKey = `${processedKeyword}_${this.options.caseSensitive}_${this.options.wordsOnly}`;
    if (this.patternCache.has(cacheKey)) {
      // 更新 LRU 顺序
      const index = this.patternCacheOrder.indexOf(cacheKey);
      if (index > -1) {
        this.patternCacheOrder.splice(index, 1);
      }
      this.patternCacheOrder.push(cacheKey);
      return this.patternCache.get(cacheKey);
    }

    // 转义特殊字符
    let escapedKeyword = processedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    
    // 添加单词边界
    if (this.options.wordsOnly) {
      escapedKeyword = `${this.options.wordsBoundary}${escapedKeyword}${this.options.wordsBoundary}`;
    }

    // 根据配置决定是否大小写敏感
    const flags = this.options.caseSensitive ? "g" : "gi";
    const pattern = new RegExp(`(?:${escapedKeyword})`, flags);

    // 使用 LRU 缓存策略
    if (this.patternCache.size >= this.MAX_PATTERN_CACHE) {
      const oldestKey = this.patternCacheOrder.shift();
      this.patternCache.delete(oldestKey);
    }

    this.patternCache.set(cacheKey, pattern);
    this.patternCacheOrder.push(cacheKey);
    return pattern;
  }

  // 高效批量处理节点
  _processNodes(nodes, keywords) {
    const batchSize = this.config.performance.batch.size;
    const total = nodes.length;

    for (let i = 0; i < total; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      batch.forEach((node) => this._highlightNode(node, keywords));
    }
  }

  // 优化的节点高亮处理
  _highlightNode(node, keywords) {
    const text = node.nodeValue;
    const matches = this._findMatches(text, keywords);

    if (!matches.length) return;

    // 使用文档片段优化 DOM 操作
    const fragment = this._createHighlightFragment(text, matches);
    if (fragment) {
      node.parentNode.replaceChild(fragment, node);
    }
  }

  // 优化的匹配查找
  _findMatches(text, keywords) {
    const matches = [];
    const ranges = []; // 使用排序数组存储范围

    for (const keyword of keywords) {
      const pattern = this._getSearchPattern(keyword.words);
      let match;

      pattern.lastIndex = 0; // 重置正则表达式的lastIndex
      while ((match = pattern.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;

        // 使用严格比较确保大小写完全匹配
        const matchedText = text.slice(start, end);
        if (
          matchedText === keyword.words &&
          !this._hasOverlap(ranges, start, end)
        ) {
          matches.push({
            start,
            end,
            text: matchedText,
            keyword,
          });
          ranges.push([start, end]);
        }
      }
    }

    // 按开始位置排序
    ranges.sort((a, b) => a[0] - b[0]);
    return matches.sort((a, b) => a.start - b.start);
  }

  // 优化的重叠检查
  _hasOverlap(ranges, start, end) {
    // 二分查找优化的重叠检查
    let left = 0;
    let right = ranges.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const [rangeStart, rangeEnd] = ranges[mid];

      if (end <= rangeStart) {
        right = mid - 1;
      } else if (start >= rangeEnd) {
        left = mid + 1;
      } else {
        return true; // 找到重叠
      }
    }

    return false;
  }

  /**
   * 创建高亮文档片段
   * @param {string} text - 需要处理的原始文本
   * @param {Array} matches - 匹配结果数组，每个元素包含 start、end、text 和 keyword 属性
   * @returns {DocumentFragment|null} - 返回包含高亮内容的文档片段，如果输入无效则返回 null
   */
  _createHighlightFragment(text, matches) {
    // 只在完全无效时返回null
    if (!text || !matches) return null;

    // 创建文档片段用于存储所有节点
    const fragment = document.createDocumentFragment();
    // 记录上一个匹配结束的位置
    let lastIndex = 0;

    // 遍历所有匹配项，处理每个需要高亮的部分
    for (const match of matches) {
      // 处理匹配项之前的普通文本
      if (match.start > lastIndex) {
        const beforeText = text.slice(lastIndex, match.start);
        // 移除严格检查，允许空字符串
        const textNode = document.createTextNode(beforeText);
        fragment.appendChild(textNode);
      }

      // 创建高亮元素
      const highlight = document.createElement("span");
      // 设置高亮样式类，colour用于不同颜色的高亮
      highlight.className = `${this.config.className} ${
        this.config.stylePrefix
      }${match.keyword.colour || 1}`;
      // 使用innerHTML代替textContent以保持DOM结构
      highlight.innerHTML = match.text || ""; // 允许空文本
      // 设置样式确保文本不会变成斜体
      highlight.style.fontStyle = "normal";
      // 将高亮元素添加到片段中
      fragment.appendChild(highlight);

      // 添加回调支持
      if (typeof this.options.highlightCallback === 'function') {
        this.options.highlightCallback(highlight, match);
      }

      // 更新处理位置
      lastIndex = match.end;
    }

    // 处理最后一个匹配项之后的剩余文本
    if (lastIndex < text.length) {
      const afterText = text.slice(lastIndex);
      // 移除严格检查，允许空字符串
      const textNode = document.createTextNode(afterText);
      fragment.appendChild(textNode);
    }

    return fragment;
  }

  // 清理空的高亮 span 标签
  _cleanEmptySpans(container) {
    if (!container) return;

    const spans = Array.from(
      container.getElementsByClassName(this.config.className)
    );

    this.processBatch(spans, (span) => {
      if (!span.textContent.trim()) {
        span.remove();
      }
    });
  }

  // 优化后的清理高亮方法
  clearHighlight(node) {
    try {
      if (!node) return;

      // 获取所有高亮元素
      const highlights = node.getElementsByClassName(this.config.className);
      if (!highlights || highlights.length === 0) return;

      // 使用类似jQuery flatten的方法处理高亮元素
      const highlightsArray = Array.from(highlights);
      
      // 按父节点分组，减少normalize()调用次数
      const parentMap = new Map();
      
      highlightsArray.forEach(highlight => {
        if (!highlight || !highlight.parentNode) return;
        
        const parent = highlight.parentNode;
        if (!parentMap.has(parent)) {
          parentMap.set(parent, true);
        }
        
        // 直接替换高亮元素为其子节点
        const fragment = document.createDocumentFragment();
        while (highlight.firstChild) {
          fragment.appendChild(highlight.firstChild);
        }
        highlight.parentNode.replaceChild(fragment, highlight);
      });
      
      // 对所有涉及的父节点调用normalize()
      parentMap.forEach((_, parent) => {
        parent.normalize();
      });

      // 清理缓存
      this.nodeStates = new WeakMap();
      this.patternCache.clear();
      this.fragmentCache = new WeakMap();
    } catch (error) {
      console.error("清理高亮失败:", error);
    }
  }

  // 修改清理高亮状态的方法
  cleanHighlightState(node) {
    try {
      if (!node || !node.parentNode) return;
      
      // 创建文档片段
      const fragment = document.createDocumentFragment();
      
      // 复制高亮节点的内容到片段
      while (node.firstChild) {
        fragment.appendChild(node.firstChild);
      }
      
      // 替换高亮节点
      node.parentNode.replaceChild(fragment, node);
      
      // 使用normalize()合并相邻文本节点，与clearHighlight保持一致
      node.parentNode.normalize();
      
    } catch (error) {
      console.error("清理单个高亮失败:", error);
    }
  }

  // 优化文本节点处理
  _processTextNode(node, keywords) {
    if (!Utils.dom.isTextNode(node) || !keywords?.length) return;

    const text = node.textContent;
    if (!text) return;

    // 检查父节点
    const parentElement = node.parentElement;
    if (!parentElement || this.shouldSkipNode(parentElement)) return;
    
    // 快速检查是否有任何关键词在文本中
    let hasMatch = false;
    for (const keyword of keywords) {
      const keywordText = keyword.words || keyword;
      if (text.includes(keywordText)) {
        hasMatch = true;
        break;
      }
    }
    
    // 如果没有匹配，直接返回，避免不必要的处理
    if (!hasMatch) return;

    // 检查缓存
    const cacheKey = `${text}_${keywords.map((k) => k.words || k).join("_")}`;
    const cachedFragment = this.fragmentCache.get(node);
    if (cachedFragment && cachedFragment.key === cacheKey) {
      node.parentNode.replaceChild(
        cachedFragment.fragment.cloneNode(true),
        node
      );
      return;
    }

    // 创建匹配结果数组
    const matches = [];
    const usedRanges = [];

    // 首先按长度排序关键词，优先匹配最长的
    const sortedKeywords = [...keywords].sort((a, b) => {
      const lenA = (a.words || a).length;
      const lenB = (b.words || b).length;
      return lenB - lenA;
    });

    // 查找所有匹配
    for (const keyword of sortedKeywords) {
      const keywordText = keyword.words || keyword;
      let index = text.indexOf(keywordText);

      while (index !== -1) {
        const end = index + keywordText.length;

        // 使用二分查找优化重叠检查
        if (!this._hasOverlap(usedRanges, index, end)) {
          matches.push({
            start: index,
            end: end,
            text: text.slice(index, end),
            keyword: keyword,
          });
          usedRanges.push([index, end]);
          usedRanges.sort((a, b) => a[0] - b[0]);
        }

        // 继续查找下一个匹配
        index = text.indexOf(keywordText, index + 1);
      }
    }

    // 如果没有匹配，直接返回
    if (matches.length === 0) return;

    // 按开始位置排序匹配结果
    matches.sort((a, b) => a.start - b.start);

    // 创建高亮片段
    const fragment = this._createHighlightFragment(text, matches);
    if (fragment) {
      // 缓存片段以便重用
      this.fragmentCache.set(node, {
        key: cacheKey,
        fragment: fragment.cloneNode(true),
      });

      // 替换原始节点
      node.parentNode.replaceChild(fragment, node);
    }
  }

  // 获取颜色索引
  _getColorIndex(keyword) {
    let index = this.patternCache.get(keyword);
    if (!index) {
      index = (this.patternCache.size % 20) + 1;
      this.patternCache.set(keyword, index);
    }
    return index;
  }

  // 添加变音符号处理
  _removeDiacritics(text) {
    return text
      .replace(/[\u00c0-\u00c6]/g, 'A')
      .replace(/[\u00e0-\u00e6]/g, 'a')
      .replace(/[\u00c7]/g, 'C')
      .replace(/[\u00e7]/g, 'c')
      .replace(/[\u00c8-\u00cb]/g, 'E')
      .replace(/[\u00e8-\u00eb]/g, 'e')
      .replace(/[\u00cc-\u00cf]/g, 'I')
      .replace(/[\u00ec-\u00ef]/g, 'i')
      .replace(/[\u00d1|\u0147]/g, 'N')
      .replace(/[\u00f1|\u0148]/g, 'n')
      .replace(/[\u00d2-\u00d8|\u0150]/g, 'O')
      .replace(/[\u00f2-\u00f8|\u0151]/g, 'o')
      .replace(/[\u0160]/g, 'S')
      .replace(/[\u0161]/g, 's')
      .replace(/[\u00d9-\u00dc]/g, 'U')
      .replace(/[\u00f9-\u00fc]/g, 'u')
      .replace(/[\u00dd]/g, 'Y')
      .replace(/[\u00fd]/g, 'y');
  }
}

// 创建单例实例
window.highlighter = new TextHighlighter();
