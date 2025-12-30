import { ApolloProvider } from '@apollo/client/react';
import { DynamicWalletProvider } from './providers/DynamicWalletProvider';
import { client } from './apollo/index';
import UserInfo from './components/UserInfo';
import QuizList from './components/QuizList';

import CreateQuizForm from './components/CreateQuizForm';
import QuizTakingPage from './components/QuizTakingPage';
import QuizRankings from './components/QuizRankings';
import WalletConnectionScreen from './components/WalletConnectionScreen';
import { BrowserRouter, Routes, Route, Link, Outlet } from 'react-router-dom';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import NotificationProvider from './components/NotificationContext';
import NotificationContainer from './components/NotificationContainer';
import ConnectionProvider from './contexts/ConnectionContext';
import { useConnection } from './contexts/ConnectionContext';
import { UserProvider } from './contexts/UserContext';
import './App.css';

// 创建Header组件
const Header: React.FC = () => {
  const { user, primaryWallet } = useDynamicContext();

  return (
    <header className="app-header">
      <div className="header-content">
        <Link to="/" className="logo-link">
          <h1>Quiz Challenge</h1>
        </Link>
        <div className="header-right">
          <nav className="main-nav">
            <Link to="/quizzes" className="nav-link">
              Quizzes
            </Link>
            <Link to="/create" className="nav-link">
              Create
            </Link>
          </nav>
          {user && primaryWallet && <UserInfo />}
        </div>
      </div>
    </header>
  );
};

// 创建受保护的路由组件
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { primaryWallet } = useDynamicContext();
  const { isLineraConnected, isConnecting, connectionError } = useConnection();

  // 如果钱包未连接，显示钱包连接屏幕
  if (!primaryWallet?.address) {
    return <WalletConnectionScreen />;
  }

  // 如果正在连接Linera，显示加载屏幕
  if (isConnecting) {
    return (
      <WalletConnectionScreen
        isLoading={true}
        loadingText="正在连接到 钱包 ..."
      />
    );
  }

  // 如果连接失败且未连接到Linera，显示连接错误
  if (!isLineraConnected && connectionError) {
    return (
      <WalletConnectionScreen showError={true} errorText={connectionError} />
    );
  }

  // 钱包已连接，显示受保护的内容（即使Linera连接可能还在后台处理）
  return <>{children}</>;
};

// 创建首页组件
const HomePage: React.FC = () => {
  return (
    <div className="home-page">
      <div className="home-content">
        <h2>Welcome to Quiz Challenge</h2>
        <p>Test your knowledge, create quizzes, and compete with others!</p>
        <div className="home-actions">
          <Link to="/quizzes" className="btn-primary">
            Browse Quizzes
          </Link>
          <Link to="/create" className="btn-secondary">
            Create Your Quiz
          </Link>
        </div>
      </div>
    </div>
  );
};

// 创建Layout组件
const Layout: React.FC = () => {
  return (
    <div className="app-container">
      <Header />
      <div className="global-banner">
        提示：为确保数据准确性，系统需要同步最新区块信息，当前显示的数据可能存在轻微延迟。
      </div>
      <main className="app-main">
        <Outlet />
      </main>

      {/* Usage Guide */}
      <section className="usage-guide">
        <h2>How to Use</h2>
        <div className="usage-steps">
          <div className="usage-step">
            <div className="step-number">1</div>
            <h3>Create Quiz</h3>
            <p>
              Add questions and set points for each question to create your own
              quiz challenge
            </p>
          </div>
          <div className="usage-step">
            <div className="step-number">2</div>
            <h3>Share & Participate</h3>
            <p>
              Invite others to participate, the system will calculate scores
              based on answer speed and accuracy
            </p>
          </div>
          <div className="usage-step">
            <div className="step-number">3</div>
            <h3>View Rankings</h3>
            <p>
              Check real-time participant rankings to see the fastest and most
              accurate quiz masters
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <DynamicWalletProvider>
        <ApolloProvider client={client}>
          <NotificationProvider>
            <ConnectionProvider>
              <UserProvider>
                <Routes>
                  <Route path="/" element={<Layout />}>
                    {/* 根路径显示首页内容 */}
                    <Route index element={<HomePage />} />
                    {/* 为QuizList添加专用路由 */}
                    <Route
                      path="/quizzes"
                      element={
                        <ProtectedRoute>
                          <div className="content-wrapper">
                            <div className="content-header">
                              <h2>Quizzes</h2>
                            </div>
                            <QuizList />
                          </div>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/create"
                      element={
                        <ProtectedRoute>
                          <div className="content-wrapper">
                            <div className="content-header">
                              <h2>Create Quiz</h2>
                            </div>
                            <CreateQuizForm />
                          </div>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/quiz/:quizId"
                      element={
                        <ProtectedRoute>
                          <div className="content-wrapper">
                            <div className="content-header">
                              <h2>Take Quiz</h2>
                            </div>
                            <QuizTakingPage />
                          </div>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/quiz-rank/:quizId"
                      element={
                        <ProtectedRoute>
                          <div className="content-wrapper">
                            <div className="content-header">
                              <h2>Quiz Rankings</h2>
                            </div>
                            <QuizRankings />
                          </div>
                        </ProtectedRoute>
                      }
                    />
                  </Route>
                </Routes>
                <NotificationContainer />
              </UserProvider>
            </ConnectionProvider>
          </NotificationProvider>
        </ApolloProvider>
      </DynamicWalletProvider>
    </BrowserRouter>
  );
}

export default App;
