// 基础变量
const greeting = "Hello, Parseo";
let count = 0;

// 函数定义
function add(a, b) {
  return a + b;
}

// 包含 JSX 的变量 (React 风格)
const element = <div className="demo">JSX in JS</div>;

// 导出
export default {
  greeting,
  add,
  element
};
