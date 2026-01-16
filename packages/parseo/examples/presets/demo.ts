// 接口定义
interface User {
  id: number;
  name: string;
}

// 类型别名
type Status = 'active' | 'inactive';

// 泛型函数
function identity<T>(arg: T): T {
  return arg;
}

// TSX 组件
const UserCard = ({ user }: { user: User }) => {
  return (
    <div className="card">
      <h3>{user.name}</h3>
      <span className="id">#{user.id}</span>
    </div>
  );
}

const currentUser: User = { id: 1, name: "Parseo User" };
