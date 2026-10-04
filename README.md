# 🎨 Sketcha

**Sketcha** is a fast, responsive, and real-time collaborative whiteboard application. Designed with seamless synchronization and a beautiful UI, it allows multiple users to draw, brainstorm, and interact simultaneously on the same canvas across any device.

## ✨ Features

- **⚡ Real-Time Collaboration:** See what others are drawing instantly, powered by Socket.io.
- **📱 Fully Responsive & Touch-Friendly:** Works flawlessly on desktop and mobile. Features precise touch controls and pinch-to-zoom for mobile devices.
- **🛠️ Rich Toolset:** Pencil, Eraser, Line, Rectangle, Circle, and Text tools.
- **✋ Select & Move:** Easily select any drawn object and drag it around the canvas.
- **🎨 Customization:** Change brush sizes, colors, and font styles on the fly.
- **🔄 History Management:** Full support for Undo, Redo, and Canvas Clear.
- **👀 Live User Presence:** See who is currently active and drawing in your room.

## 🚀 Tech Stack

- **Frontend:** React, TypeScript, Vite, HTML5 Canvas API
- **Backend:** Node.js, Express.js, Socket.io
- **Styling:** Custom CSS (Modern, Glassmorphism UI)

## 💻 Setup & Installation

Follow these steps to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

You need to have [Node.js](https://nodejs.org/) installed on your machine.

### 1. Clone the repository

```bash
git clone https://github.com/NikolaiPetrov31/sketcha.git
cd sketcha
```

### 2. Install Dependencies

Install the required npm packages for both the frontend and the backend.

```bash
npm install
```

### 3. Configuration

By default, the application is configured to run on `localhost`. 
If you want to run it on your local network (so you can connect from your phone) or deploy it to production, edit the `src/config.ts` file:

```typescript
// src/config.ts
export const config = {
  // Change to your local IPv4 address if testing on a phone (e.g. 'http://192.168.1.5:3001')
  SOCKET_URL: 'http://127.0.0.1:3001',
  DRAWING_THROTTLE_MS: 40,
};
```

### 4. Start the Backend Server

Open a terminal window and start the Socket.io Node.js server:

```bash
node server/server.js
```
*The server will start listening on port 3001.*

### 5. Start the Frontend Development Server

Open a **new, separate terminal window** and run the Vite development server:

```bash
npm run dev
```

### 6. Open the App

Open your browser and navigate to the local link provided by Vite (usually `http://localhost:5173`).

---

## 🤝 Contributing

Contributions, issues, and feature requests are highly welcome! Feel free to check the issues page if you want to contribute.

## 📝 License

This project is open-source and available under the [MIT License](LICENSE).
