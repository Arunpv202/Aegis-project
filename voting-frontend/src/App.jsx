import { BrowserRouter, Routes, Route } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Auth/Login";
import Signup from "./pages/Auth/Signup";

import BlockchainExplorer from "./pages/BlockchainExplorer.jsx";
import BlockExplorerPage from "./pages/blockexplorer/BlockExplorerPage";
import GenerateKey from "./pages/GenerateKey";
/* ================= ADMIN ================= */
import AdminDashboard from "./pages/Admin/AdminDashboard";
import CreateElection from "./pages/Admin/CreateElection";
import RegisterUsers from "./pages/Admin/RegisterUsers";
import ElectionSetup from "./pages/Admin/ElectionSetup";
import ViewElections from "./pages/Admin/ViewElections";

/* ================= AUTHORITY ================= */
import EnterDKG from "./pages/Authority/EnterDKG";
import DKGDashboard from "./pages/Authority/DKG/DKGDashboard";
import AuthorityDecryption from "./pages/Authority/AuthorityDecryption";

/* ================= USER ================= */
import UserDashboard from "./pages/User/UserDashboard";
import RegisterElection from "./pages/User/RegisterElection";
import ExistingElections from "./pages/User/ExistingElections";
import EnterElection from "./pages/User/EnterElection";
import FaceVerification from "./pages/User/FaceVerification";
import VotePage from "./pages/User/VotePage";
import ParticipatedElections from "./pages/User/ParticipatedElections";

import ResultPage from "./pages/Common/ResultPage";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* -------- Public -------- */}
        <Route path="/" element={<Landing />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        {/* <Route path="/connect-wallet" element={<ConnectWallet />} /> DEPRECATED */}
        <Route path="/generate-key" element={<GenerateKey />} />
        <Route path="/results/:id" element={<ResultPage />} />

        {/* -------- Protected Routes -------- */}
        <Route element={<ProtectedRoute />}>
          {/* -------- Admin -------- */}
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/create-election" element={<CreateElection />} />
          <Route path="/admin/register-users" element={<RegisterUsers />} />
          <Route path="/admin/election-setup" element={<ElectionSetup />} />
          <Route path="/admin/view-elections" element={<ViewElections />} />
          <Route path="/admin/blockchain-explorer/:electionId" element={<BlockchainExplorer />} />
          <Route path="/blockexplorer" element={<BlockExplorerPage />} />

          {/* -------- Authority -------- */}
          <Route path="/authority/enter" element={<EnterDKG />} />
          <Route path="/authority/dkg/:electionId" element={<DKGDashboard />} />
          <Route path="/authority/dkg/dashboard/:id" element={<AuthorityDecryption />} />

          {/* -------- User -------- */}
          <Route path="/user/dashboard" element={<UserDashboard />} />
          <Route path="/user/register-election" element={<RegisterElection />} />
          <Route path="/user/existing-elections" element={<ExistingElections />} />
          <Route path="/user/enter-election" element={<EnterElection />} />
          <Route path="/user/face-verification" element={<FaceVerification />} />
          <Route path="/user/vote/:election_id" element={<VotePage />} />
          <Route path="/user/participated" element={<ParticipatedElections />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
