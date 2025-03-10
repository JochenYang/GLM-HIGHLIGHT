// 核心高亮类
class TextHighlighter {
  constructor(options = {}) {
    // 使用统一配置
    this.config = {
      ...window.HighlighterConfig,
      ...options,
    };

    // 合并选项 - 移除冗余参数
    this.options = {
      caseSensitive: true,
      className: this.config.className,
      stylePrefix: this.config.stylePrefix,
      // 保留有用的选项
      wordsOnly: false,
      wordsBoundary: '\\b',
      ignoreDiacritics: false,
      highlightCallback: null,
      ...options,
    };

    // 简化缓存实现
    this.MAX_PATTERN_CACHE = 5000;
    this.nodeStates = new WeakMap();
    this.patternCache = new Map();
    this.patternCacheOrder = [];
  }

  clearCache() {
    this.nodeStates = new WeakMap();
    this.patternCache.clear();
    this.patternCacheOrder = [];
  }

  // 简化的节点跳过逻辑
  shouldSkipNode(node) {
    return Utils.dom.shouldSkipNode(node, this.config);
  }

  // 高亮主函数
  highlight(node, keywords) {
    if (!node || !keywords?.length) return;

    try {
      // 检查是否需要强制刷新高亮（颜色变更时）
      const needsRefresh = keywords.some(kw => {
        if (typeof kw === 'object' && kw._colorUpdated) {
          delete kw._colorUpdated; // 使用后清除标记
          return true;
        }
        return false;
      });

      // 如果需要刷新，先清除现有高亮
      if (needsRefresh) {
        this.clearHighlight(node);
        this.clearCache();
      }

      // 一次性收集所有文本节点
      const textNodes = this._collectTextNodes(node);
      
      // 使用Range API直接处理节点
      let highlightedCount = 0;
      textNodes.forEach((textNode) => {
        if (this._highlightWithRange(textNode, keywords)) {
          highlightedCount++;
        }
      });
      
      // 如果有节点被高亮，清理空的span标签
      if (highlightedCount > 0) {
        this._cleanEmptySpans(node);
      }
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

  // 清理空的高亮 span 标签
  _cleanEmptySpans(container) {
    if (!container) return;

    const spans = Array.from(
      container.getElementsByClassName(this.config.className)
    );

    // 直接处理所有空span，不再使用批处理
    spans.forEach((span) => {
      if (!span.textContent.trim()) {
        span.remove();
      }
    });
  }

  // 清理高亮 - 简化逻辑
  clearHighlight(elem) {
    if (!elem) return;

    const spans = Array.from(
      elem.getElementsByClassName(this.config.className)
    );

    // 直接处理所有高亮span，不再需要批处理
    spans.forEach((span) => {
      // 使用更安全的DOM操作替换span
      if (span.parentNode) {
        const text = document.createTextNode(span.textContent);
        span.parentNode.replaceChild(text, span);
      }
    });
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

  // 添加配置更新方法
  updateConfig(newConfig) {
    // 比较颜色变更
    const colorChanged = this.config.stylePrefix !== newConfig.stylePrefix ||
                        this.config.className !== newConfig.className;
                        
    // 更新配置
    this.config = {
      ...this.config,
      ...newConfig,
    };
    
    // 同步更新options
    this.options.className = this.config.className;
    this.options.stylePrefix = this.config.stylePrefix;
    
    // 清除缓存强制重新高亮
    this.clearCache();
    
    // 如果颜色变更，发送事件通知需要刷新
    if (colorChanged && typeof window.dispatchEvent === 'function') {
      const event = new CustomEvent('highlighter:config-updated', {
        detail: { colorChanged: true }
      });
      window.dispatchEvent(event);
    }
    
    return colorChanged; // 返回是否变更颜色，便于调用者决定是否需要刷新
  }

  // 修复高亮方法
  _highlightWithRange(node, keywords) {
    if (!Utils.dom.isTextNode(node) || !keywords?.length) return false;

    const text = node.textContent;
    if (!text) return false;

    // 检查父节点
    const parentElement = node.parentElement;
    if (!parentElement || this.shouldSkipNode(parentElement)) return false;
    
    // 快速检查是否有任何关键词在文本中
    let hasMatch = false;
    for (const keyword of keywords) {
      const keywordText = keyword.words || keyword;
      if (text.includes(keywordText)) {
        hasMatch = true;
        break;
      }
    }
    
    // 如果没有匹配，直接返回
    if (!hasMatch) return false;

    // 修改缓存键生成，加入配置变量，确保配置变更时缓存失效
    const configVersion = JSON.stringify({
      className: this.config.className,
      stylePrefix: this.config.stylePrefix
    });
    const cacheKey = `${text}_${keywords.map((k) => k.words || k).join("_")}_${configVersion}`;
    
    // 检查节点是否已经处理过
    if (this.nodeStates.has(node) && this.nodeStates.get(node) === cacheKey) {
      return false; // 已处理过，避免重复处理
    }

    // 查找所有匹配
    const matches = [];
    const usedRanges = [];

    // 按长度排序关键词，优先匹配最长的
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

        // 检查重叠
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
    if (matches.length === 0) return false;

    try {
      // 按开始位置排序匹配结果（从后向前处理，避免位置偏移）
      matches.sort((a, b) => b.start - a.start);

      // 使用Range API直接在DOM中创建高亮
      const doc = node.ownerDocument;
      
      for (const match of matches) {
        try {
          // 创建Range对象，只选择匹配的关键词部分
          const range = doc.createRange();
          range.setStart(node, match.start);
          range.setEnd(node, match.end);
          
          // 创建高亮元素 - 使用正确的配置引用
          const highlight = doc.createElement("span");
          
          // 正确处理颜色类名，从config中获取
          const colorClass = match.keyword.colour || 1;
          highlight.className = `${this.config.className} ${this.config.stylePrefix}${colorClass}`;
          
          // 使用Range直接包装文本
          range.surroundContents(highlight);
          
          // 添加回调支持
          if (typeof this.options.highlightCallback === 'function') {
            this.options.highlightCallback(highlight, match);
          }
        } catch (rangeError) {
          console.warn("Range操作失败，可能是DOM结构复杂:", rangeError);
          continue;
        }
      }
      
      // 标记节点已处理
      this.nodeStates.set(node, cacheKey);
      return true;
    } catch (error) {
      console.error("高亮处理失败:", error);
      return false;
    }
  }

  _hasOverlap(usedRanges, start, end) {
    for (const range of usedRanges) {
      if (start < range[1] && end > range[0]) {
        return true;
      }
    }
    return false;
  }
}

// 创建单例实例
window.highlighter = new TextHighlighter();
