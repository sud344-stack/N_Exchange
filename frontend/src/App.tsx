import { MarketProvider } from './context/MarketContext';
import { Dashboard } from './pages/Dashboard';

function App() {
  return (
    <MarketProvider>
      <Dashboard />
    </MarketProvider>
  );
}

export default App;
