// DOM清理工具
class DOMCleaner {
  // 使用统一的配置
  static get config() {
    return window.HighlighterConfig;  // 直接使用全局配置
  }
  
  // 使用highlighter的节点状态管理
  static get nodeStates() {
    return window.highlighter?.nodeStates;
  }

  // 统一的节点检查逻辑
  static shouldSkipNode(node) {
    return Utils.dom.shouldSkipNode(node, this.config);
  }

  // 清理空的span标签
  static cleanEmptySpans(container) {
    if (!container) return;

    const spans = Array.from(container.getElementsByClassName(this.config.className));
    const batchSize = this.config.performance.calculateBatchSize();
    let processed = 0;

    const processBatch = () => {
      const end = Math.min(processed + batchSize, spans.length);
      
      for (let i = processed; i < end; i++) {
        const span = spans[i];
        if (!span.textContent.trim()) {
          span.remove();
        }
      }
      
      processed = end;
      if (processed < spans.length) {
        requestAnimationFrame(processBatch);
      }
    };

    requestAnimationFrame(processBatch);
  }

  // 清理容器中的无效高亮
  static cleanContainer(container) {
    if (!container) return;

    const highlights = container.getElementsByClassName(this.config.className);
    if (!highlights.length) return;

    Array.from(highlights).forEach(highlight => {
      if (!this.shouldSkipNode(highlight)) {
        // 使用相同的清除逻辑
        if (highlight.previousSibling?.nodeType === Node.TEXT_NODE && 
            highlight.nextSibling?.nodeType === Node.TEXT_NODE) {
          highlight.previousSibling.nodeValue = 
            highlight.previousSibling.nodeValue + 
            highlight.textContent + 
            highlight.nextSibling.nodeValue;
          highlight.nextSibling.remove();
        } else if (highlight.previousSibling?.nodeType === Node.TEXT_NODE) {
          highlight.previousSibling.nodeValue = 
            highlight.previousSibling.nodeValue + highlight.textContent;
        } else if (highlight.nextSibling?.nodeType === Node.TEXT_NODE) {
          highlight.nextSibling.nodeValue = 
            highlight.textContent + highlight.nextSibling.nodeValue;
        } else {
          const textNode = document.createTextNode(highlight.textContent);
          highlight.parentNode.insertBefore(textNode, highlight);
        }
        highlight.remove();
      }
    });
  }

  // 优化的文本节点处理
  static handleTextNode(node) {
    if (!Utils.dom.isTextNode(node) || this.shouldSkipNode(node)) return;
    
    try {
      if (this.nodeStates?.has(node)) return;
      this.nodeStates?.set(node, true);
      return node.textContent;
    } catch (error) {
      console.warn('文本节点处理失败:', error);
      return null;
    }
  }

  // 优化清理批处理
  static cleanNodes(nodes) {
    if (!nodes?.length) return;

    const batchSize = this.config.performance.calculateBatchSize();
    let processed = 0;

    const processBatch = () => {
      const end = Math.min(processed + batchSize, nodes.length);
      
      for (let i = processed; i < end; i++) {
        const node = nodes[i];
        if (node && !this.shouldSkipNode(node)) {
          this.cleanContainer(node);
        }
      }

      processed = end;
      if (processed < nodes.length) {
        requestAnimationFrame(processBatch);
      }
    };

    requestAnimationFrame(processBatch);
  }
} 