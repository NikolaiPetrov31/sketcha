import React from 'react';
import logo from '../assets/sketcha-logo.png';

interface LandingProps {
  currentView: 'home' | 'create' | 'workspace';
  handleCreateRoomClick: () => void;
  roomCode: string;
  setRoomCode: (val: string) => void;
  showJoinName: boolean;
  joinUsername: string;
  setJoinUsername: (val: string) => void;
  handleJoinRoom: (e: React.FormEvent) => void;
  joinError: string;
  username: string;
  setUsername: (val: string) => void;
  roomName: string;
  setRoomName: (val: string) => void;
  handleCreateRoomSubmit: (e: React.FormEvent) => void;
}

export const LandingUI: React.FC<LandingProps> = (props) => {
  return (
    <>
      <div className={`slider-view view-home ${props.currentView === 'home' ? 'active' : 'inactive-left'}`}>
        <div className="view-content-wrapper">
          <div className="hero-section">
            <h1 className="hero-title">
              Visual collaboration <br />
              <span className="highlight-text">without boundaries.</span>
            </h1>
            <p className="hero-subtitle">
              The fastest way to sketch, wireframe, and brainstorm with your team. Secure rooms, endless canvas, zero friction.
            </p>
          </div>

          <div className="cards-wrapper">
            <div className="feature-card floating-card delay-1">
              <div className="card-content">
                <div className="icon-wrapper">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2 className="card-title">Host a Workspace</h2>
                <p className="card-desc">Instantly launch a blank canvas and invite collaborators via a secure link.</p>
                <button className="btn btn-primary" onClick={props.handleCreateRoomClick}>
                  Create New Room
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginLeft: '4px' }}>
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="feature-card floating-card delay-2">
              <div className="card-content">
                <div className="icon-wrapper">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 3H21V9M21 3L14 10M10 21H3V14M3 21L10 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2 className="card-title">Join Existing Room</h2>
                <p className="card-desc">Have an invite code? Enter it below to instantly hop into an active session.</p>

                <form className="join-form" onSubmit={props.handleJoinRoom}>
                  {!props.showJoinName ? (
                    <div className="input-group">
                      <input
                        type="text"
                        placeholder="e.g. AB12CD"
                        value={props.roomCode}
                        onChange={(e) => props.setRoomCode(e.target.value.toUpperCase())}
                        maxLength={6}
                      />
                      <button type="submit" className="btn btn-secondary" disabled={!props.roomCode.trim()}>
                        Join
                      </button>
                    </div>
                  ) : (
                    <div className="input-group">
                      <input
                        type="text"
                        placeholder="Your Name"
                        value={props.joinUsername}
                        onChange={(e) => props.setJoinUsername(e.target.value)}
                        autoFocus
                      />
                      <button type="submit" className="btn btn-secondary" disabled={!props.joinUsername.trim()}>
                        Go
                      </button>
                    </div>
                  )}
                  {props.joinError && <p className="join-error">{props.joinError}</p>}
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`slider-view view-create ${props.currentView === 'create' ? 'active' : 'inactive-right'}`}>
        <div className="view-content-wrapper">
          <div className="hero-section">
            <h1 className="hero-title">
              Configure your <br />
              <span className="highlight-text">new workspace.</span>
            </h1>
            <p className="hero-subtitle">
              Set up your display name and workspace name before launching the canvas and inviting collaborators.
            </p>
          </div>

          <div className="cards-wrapper">
            <div className="feature-card floating-card delay-1" style={{ width: '100%' }}>
              <div className="card-content" style={{ padding: '2rem' }}>
                <div className="icon-wrapper">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h2 className="card-title">Room Details</h2>
                <p className="card-desc">Enter your name and workspace name to instantly host a new session.</p>

                <form onSubmit={props.handleCreateRoomSubmit} className="create-form" style={{ flexDirection: 'row', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                  <div className="input-group" style={{ flex: 1, marginTop: 0 }}>
                    <input
                      type="text"
                      id="username"
                      placeholder="Your Name (e.g. John Doe)"
                      value={props.username}
                      onChange={(e) => props.setUsername(e.target.value)}
                    />
                  </div>

                  <div className="input-group" style={{ flex: 1, marginTop: 0 }}>
                    <input
                      type="text"
                      id="roomName"
                      placeholder="Room Name (e.g. Design Sync)"
                      value={props.roomName}
                      onChange={(e) => props.setRoomName(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={!props.username.trim() || !props.roomName.trim()} style={{ whiteSpace: 'nowrap' }}>
                    Launch Workspace
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginLeft: '6px' }}>
                      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
