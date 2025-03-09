const createHighlighterConfig = () => {
  const config = {
    // 默认的样式类名
    className: "chrome-extension-mutihighlight",
    stylePrefix: "chrome-extension-mutihighlight-style-",

    // 过滤规则
    filterRules: {
      shouldSkipTag(node) {
        return (
          node.tagName &&
          (["SCRIPT", "STYLE", "NOSCRIPT"].includes(node.tagName) ||
            node.isContentEditable ||
            (node.parentNode && node.parentNode.isContentEditable))
        );
      },

      shouldAllowInput(element) {
        return !(
          element &&
          (element.isContentEditable ||
            ["INPUT", "TEXTAREA"].includes(element.tagName) ||
            (element.parentNode &&
              ["SCRIPT", "STYLE", "NOSCRIPT"].includes(
                element.parentNode.tagName
              )))
        );
      },

      isEditable(node, root) {
        while (node && node !== root) {
          if (
            node.tagName &&
            (node.isContentEditable ||
              ["STYLE", "SCRIPT", "NOSCRIPT"].includes(node.tagName))
          )
            return true;
          node = node.parentNode;
        }
        return false;
      },

      // 统一的shouldSkipTag函数，可以处理node对象或tagName字符串
      shouldSkipTag: function(input) {
        // 处理null或undefined
        if (!input) return false;
        
        // 确定tagName
        let tagName;
        if (typeof input === 'string') {
          // 如果输入是字符串，直接使用
          tagName = input;
        } else if (input.tagName) {
          // 如果输入是节点对象，获取其tagName
          tagName = input.tagName;
          
          // 检查可编辑状态(从原始函数保留)
          if (input.isContentEditable || 
              (input.parentNode && input.parentNode.isContentEditable)) {
            return true;
          }
        } else {
          // 既不是字符串也不是有效节点
          return false;
        }
        
        // 转换为大写以便与数组比较
        const upperTagName = tagName.toUpperCase();
        
        // 使用正则表达式检查常见的需要跳过的标签
        if (/(script|style|noscript|iframe)/i.test(tagName)) {
          return true;
        }
        
        // 使用数组包含检查
        if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(upperTagName)) {
          return true;
        }
        
        return false;
      },

      // 改进的shouldSkipHighlighted函数
      shouldSkipHighlighted: function(node, className, elementType = 'span') {
        // 基本检查
        if (!node || !node.classList) return false;
        
        // 检查类名是否包含
        const hasClass = node.classList.contains(className);
        
        // 可选：检查标签名是否匹配(更接近jQuery的完整匹配)
        const tagMatches = !elementType || node.tagName.toLowerCase() === elementType.toLowerCase();
        
        return hasClass && tagMatches;
      },
    },

    // 精简后的性能配置
    performance: {
      // 批处理相关
      batch: {
        size: 50,  // 默认批处理大小
        maxNodes: 1000  // 单次处理最大节点数
      },

      // 防抖配置
      debounce: {
        input: 500,   // 输入防抖
        update: 500   // 更新防抖
      },

      // 保留基础节流配置
      throttle: {
        default: 100  // 默认节流时间
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
