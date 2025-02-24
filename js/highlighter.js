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
    };

    // 定期清理
    setInterval(cleanupCache, 30000); // 每30秒检查一次
  }

  clearCache() {
    this.nodeStates = new WeakMap();
    this.patternCache.clear();
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

  // 统一的节点检查
  shouldSkipNode(node) {
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

    // 使用关键词和大小写选项作为缓存键
    const cacheKey = `${keyword}_${this.options.caseSensitive}`;
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
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

  // 优化的节点过滤
  _shouldSkipNode(node) {
    // 使用相同的检查逻辑
    return this.shouldSkipNode(node);
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
      
      // 使用批处理清理高亮
      Array.from(highlights).forEach((highlight) => {
        if (!highlight || !highlight.parentNode) return;

        // 获取高亮文本
        const text = highlight.textContent;

        // 处理相邻文本节点
        if (highlight.previousSibling?.nodeType === Node.TEXT_NODE && 
            highlight.nextSibling?.nodeType === Node.TEXT_NODE) {
          // 合并前后文本节点
          highlight.previousSibling.nodeValue = 
            highlight.previousSibling.nodeValue + 
            text + 
            highlight.nextSibling.nodeValue;
          highlight.nextSibling.remove();
        } else if (highlight.previousSibling?.nodeType === Node.TEXT_NODE) {
          // 合并前面的文本节点
          highlight.previousSibling.nodeValue += text;
        } else if (highlight.nextSibling?.nodeType === Node.TEXT_NODE) {
          // 合并后面的文本节点
          highlight.nextSibling.nodeValue = text + highlight.nextSibling.nodeValue;
        } else {
          // 创建新的文本节点
          const textNode = document.createTextNode(text);
          highlight.parentNode.insertBefore(textNode, highlight);
        }

        // 移除高亮元素
        highlight.remove();
      });

      // 清理空的 span 标签
      this._cleanEmptySpans(node);

      // 清理缓存
      this.nodeStates = new WeakMap();
      this.patternCache.clear();
    } catch (error) {
      console.error("清理高亮失败:", error);
    }
  }

  // 修改清理高亮状态的方法
  cleanHighlightState(node) {
    try {
      if (!node || !node.parentNode) return;

      // 1. 收集相邻文本节点
      const prevNode = node.previousSibling;
      const nextNode = node.nextSibling;
      const text = node.textContent;

      // 2. 直接修改文本内容
      if (
        prevNode?.nodeType === Node.TEXT_NODE &&
        nextNode?.nodeType === Node.TEXT_NODE
      ) {
        // 合并相邻文本节点
        prevNode.nodeValue = prevNode.nodeValue + text + nextNode.nodeValue;
        nextNode.remove();
      } else if (prevNode?.nodeType === Node.TEXT_NODE) {
        prevNode.nodeValue = prevNode.nodeValue + text;
      } else if (nextNode?.nodeType === Node.TEXT_NODE) {
        nextNode.nodeValue = text + nextNode.nodeValue;
      } else {
        // 创建新文本节点
        const textNode = document.createTextNode(text);
        node.parentNode.insertBefore(textNode, node);
      }

      // 3. 移除高亮节点
      node.remove();
    } catch (error) {
      console.error("清理高亮状态失败:", error);
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

    // 检查缓存
    const cacheKey = `${text}_${keywords.map(k => k.words || k).join('_')}`;
    const cachedFragment = this.fragmentCache.get(node);
    if (cachedFragment && cachedFragment.key === cacheKey) {
      node.parentNode.replaceChild(cachedFragment.fragment.cloneNode(true), node);
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

        index = text.indexOf(keywordText, index + 1);
      }
    }

    // 按起始位置排序
    matches.sort((a, b) => a.start - b.start);

    // 处理匹配结果
    if (matches.length > 0) {
      // 创建文档片段
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      // 处理每个匹配
      for (const match of matches) {
        if (match.start > lastIndex) {
          fragment.appendChild(
            document.createTextNode(text.slice(lastIndex, match.start))
          );
        }

        const highlight = document.createElement("span");
        highlight.className = `${this.config.className} ${
          this.config.stylePrefix
        }${
          typeof match.keyword === "object"
            ? match.keyword.colour
            : this._getColorIndex(match.keyword)
        }`;
        highlight.textContent = match.text;
        fragment.appendChild(highlight);

        lastIndex = match.end;
      }

      // 处理剩余文本
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      // 替换原节点
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
}

// 创建单例实例
window.highlighter = new TextHighlighter();
