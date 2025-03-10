const createHighlighterConfig = () => {
  const config = {
    // 默认的样式类名
    className: "chrome-extension-mutihighlight",
    stylePrefix: "chrome-extension-mutihighlight-style-",

    // 简化过滤规则，移除重复功能
    filterRules: {
      // 统一的跳过标签检查函数
      shouldSkipTag: function(input) {
        // 处理null或undefined
        if (!input) return false;
        
        // 确定tagName
        let tagName;
        if (typeof input === 'string') {
          tagName = input;
        } else if (input.tagName) {
          tagName = input.tagName;
          
          if (input.isContentEditable || 
              (input.parentNode && input.parentNode.isContentEditable)) {
            return true;
          }
        } else {
          return false;
        }
        
        // 转换为大写以便与数组比较
        const upperTagName = tagName.toUpperCase();
        
        // 跳过不需要高亮的标签
        const skipTags = ["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "INPUT", "TEXTAREA"];
        return skipTags.includes(upperTagName) || /(script|style|noscript|iframe)/i.test(tagName);
      },

      // 检查节点是否为高亮元素
      shouldSkipHighlighted: function(node, className) {
        return node?.classList?.contains(className);
      },
      
      // 检查元素是否可编辑
      isEditable(node) {
        while (node) {
          if (node.isContentEditable || 
              ["STYLE", "SCRIPT", "NOSCRIPT", "INPUT", "TEXTAREA"].includes(node?.tagName)) {
            return true;
          }
          node = node.parentNode;
        }
        return false;
      }
    },

    // 简化后的性能配置
    performance: {
      throttle: {
        default: 10 
      },
      // 保留popup需要的配置
      debounce: {
        input: 300,
        update: 300
      }
    }
  };

  return config;
};

// 导出配置
(function (global) {
  const config = createHighlighterConfig();

  // 绑定过滤规则中的this
  Object.values(config.filterRules).forEach((fn) => {
    if (typeof fn === "function") {
      config.filterRules[fn.name] = fn.bind(config);
    }
  });

  global.HighlighterConfig = config;
})(typeof window !== "undefined" ? window : global);
