<style>
  .urdf-readme {
    --bg: #0b0f12;
    --panel: #151a1f;
    --panel-2: #1d242a;
    --line: #344047;
    --text: #eef6f4;
    --muted: #99a7ac;
    --teal: #62e6d3;
    --green: #7adf8b;
    --amber: #f5b45b;
    --blue: #69a7ff;
    color: var(--text);
    background:
      radial-gradient(circle at 18% 0%, rgba(98, 230, 211, 0.18), transparent 32%),
      linear-gradient(145deg, #0b0f12 0%, #12171b 45%, #0b0f12 100%);
    border: 1px solid var(--line);
    border-radius: 28px;
    padding: 28px;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .hero-card,
  .glass-card,
  .demo-player,
  .feature-tile {
    background: linear-gradient(145deg, rgba(31, 39, 45, 0.94), rgba(18, 23, 27, 0.96));
    border: 1px solid rgba(131, 156, 164, 0.24);
    border-radius: 22px;
    box-shadow: 0 22px 60px rgba(0, 0, 0, 0.28);
  }

  .hero-title {
    font-size: 44px;
    margin: 0;
    line-height: 1.06;
  }

  .pill {
    display: inline-block;
    padding: 8px 12px;
    border: 1px solid rgba(98, 230, 211, 0.38);
    border-radius: 999px;
    background: rgba(98, 230, 211, 0.1);
    color: var(--teal);
    font-size: 12px;
    font-weight: 700;
  }

  .muted {
    color: var(--muted);
  }

  .metric {
    font-size: 24px;
    font-weight: 800;
    color: var(--teal);
  }

  .screen {
    border-radius: 18px;
    border: 1px solid rgba(131, 156, 164, 0.24);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
  }

  .demo-player video {
    width: 100%;
    border-radius: 18px;
    border: 1px solid rgba(131, 156, 164, 0.24);
    display: block;
  }
</style>

<div class="urdf-readme">
  <div class="hero-card" align="center">
    <br />
    <img src="src/icons/urdf-builder.png" alt="URDF Builder logo" width="96" />
    <p>
      <span class="pill">ONE UI 8.5-STYLE ROBOTICS WORKBENCH</span>
    </p>
    <h1 class="hero-title">URDF Builder 2.0</h1>
    <p class="muted">
      A modern Electron desktop studio for authoring, inspecting, transforming, and packaging URDF robot descriptions.
    </p>
    <p>
      <img alt="Electron" src="https://img.shields.io/badge/Electron-42-5ad7cf?style=for-the-badge&logo=electron&logoColor=0f1720" />
      <img alt="React" src="https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=0f1720" />
      <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178c6?style=for-the-badge&logo=typescript&logoColor=white" />
      <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646cff?style=for-the-badge&logo=vite&logoColor=white" />
      <img alt="Three.js" src="https://img.shields.io/badge/Three.js-Viewport-111827?style=for-the-badge&logo=threedotjs&logoColor=white" />
      <img alt="License" src="https://img.shields.io/badge/License-Apache_2.0-f5b45b?style=for-the-badge" />
    </p>
    <br />
  </div>

  <br />

  <img class="screen" src="readme_assets/01.png" alt="URDF Builder dashboard with template gallery and recent projects" width="100%" />

  <br />
  <br />

  <table>
    <tr>
      <td align="center" width="25%">
        <div class="metric">Electron</div>
        <strong>native desktop</strong><br />
        <span class="muted">frameless windows</span>
      </td>
      <td align="center" width="25%">
        <div class="metric">Three.js</div>
        <strong>robot viewport</strong><br />
        <span class="muted">URDF mesh loading</span>
      </td>
      <td align="center" width="25%">
        <div class="metric">Monaco</div>
        <strong>XML studio</strong><br />
        <span class="muted">tabs, outline, format</span>
      </td>
      <td align="center" width="25%">
        <div class="metric">Zustand</div>
        <strong>sync pipeline</strong><br />
        <span class="muted">editor, model, scene</span>
      </td>
    </tr>
  </table>
</div>

## Live Demo

<div class="demo-player">
  <video
    src="readme_assets/_001.mp4"
    poster="readme_assets/01.png"
    autoplay
    loop
    muted
    playsinline
    controls
    preload="metadata"
    width="100%">
    <a href="readme_assets/_001.mp4">
      <img src="readme_assets/01.png" alt="Open the URDF Builder demo video" width="100%" />
    </a>
  </video>
</div>

> GitHub may sanitize native video playback on some README surfaces. If the player is not visible, open the demo directly: [readme_assets/_001.mp4](readme_assets/_001.mp4).

## Built Like A Robotics CAD Studio

<table>
  <tr>
    <td width="33%">
      <h3>Modern Startup</h3>
      Dashboard-first launch with templates, recent robots, draft recovery, native open flows, and fast access to URDF workspaces.
    </td>
    <td width="33%">
      <h3>3D Viewport</h3>
      Grid, axes, orbit camera, transform gizmo, local/world space, snapping, selection outlines, and visibility layers.
    </td>
    <td width="33%">
      <h3>Editor Workbench</h3>
      Dockable panels, detached windows, Monaco tabs, XML outline, diagnostics, timeline, and controller preview.
    </td>
  </tr>
</table>

## Screenshots

<table>
  <tr>
    <td>
      <img class="screen" src="readme_assets/02.png" alt="URDF Builder viewport with hierarchy, transform gizmo, inspector, and controller panel" />
    </td>
  </tr>
  <tr>
    <td align="center"><strong>Dockable workbench with viewport, hierarchy, inspector, and controller panels</strong></td>
  </tr>
</table>

<table>
  <tr>
    <td width="50%">
      <img class="screen" src="readme_assets/03.png" alt="Native Windows URDF open dialog inside URDF Builder" />
    </td>
    <td width="50%">
      <img class="screen" src="readme_assets/04.png" alt="Loaded AMR URDF robot with mesh rendering, outline, sensors, and transform controls" />
    </td>
  </tr>
  <tr>
    <td align="center"><strong>Native Electron file workflow</strong></td>
    <td align="center"><strong>Loaded AMR robot with visual and collision layers</strong></td>
  </tr>
</table>

## Feature Matrix

| Area | What It Does |
| --- | --- |
| <img src="src/icons/dashboard_2_gear.svg" width="18" alt="" /> Dashboard | Template gallery, recent projects, pending draft recovery, search-first startup, and dashboard-first launch. |
| <img src="src/icons/3d_rotation.svg" width="18" alt="" /> Viewport | Orbit navigation, perspective/orthographic camera, transform gizmo, grid, axes, shadows, visibility layers, and selectable URDF entities. |
| <img src="src/icons/tree.svg" width="18" alt="" /> Hierarchy | Robot/link/joint/sensor/mesh tree with recursive expand/collapse, selection sync, isolate/reveal, and context actions. |
| <img src="src/icons/code.svg" width="18" alt="" /> Monaco Editor | XML/URDF editing, tabs, split editor foundation, breadcrumbs, format action, completions, hover docs, and symbol focus. |
| <img src="src/icons/hub.svg" width="18" alt="" /> TF / Outline | TF-style relationship panel, XML outline, link/joint/sensor/material/transmission/plugin symbol groups. |
| <img src="src/icons/sync.svg" width="18" alt="" /> Sync Pipeline | Separate editor draft XML, last valid robot model, and scene render buffer for stable real-time editing. |
| <img src="src/icons/rotate.svg" width="18" alt="" /> Transform Safety | Move/rotate/scale isolation, cached gizmo commits, undo/redo history, and root-vs-entity transform ownership. |
| <img src="src/icons/folder_open.svg" width="18" alt="" /> Native Files | Open/save/save-as, open folder, recent files, package export, mesh path resolution, and `package://` support. |
| <img src="src/icons/console.svg" width="18" alt="" /> Diagnostics | URDF validation, missing mesh warnings, controller validation, console panel, status bar, and save confirmation feedback. |
| <img src="src/icons/settings.svg" width="18" alt="" /> Desktop Shell | Frameless Electron windows, detachable panels, persisted layout, dark/light theme, and Windows installer builds. |

## Robotics Workflow

1. Start from the dashboard and create a clean robot, open a URDF, or open a robot package folder.
2. Inspect the imported hierarchy, meshes, joints, sensors, diagnostics, and XML outline.
3. Edit URDF fields in Monaco or use the viewport gizmo for visual transforms.
4. Preview joint/controller behavior without mutating the authored URDF.
5. Save the URDF or export a portable package with mesh references rewritten into `./meshes`.

## Tech Stack

| Layer | Stack |
| --- | --- |
| Desktop | Electron, Electron Builder, context-isolated preload bridge |
| App | React 19, TypeScript, Vite, Zustand |
| 3D | Three.js, React Three Fiber, Drei, URDF Loader |
| Editor | Monaco Editor, fast-xml-parser, xmlbuilder2 |
| Styling | Custom workbench CSS with One UI-inspired dark surfaces, compact cards, teal accents, and Windows 11-style chrome |

## Getting Started

```powershell
git clone https://github.com/kazuha-alice/URDF-BUILDER-2.0.git
cd URDF-BUILDER-2.0
npm install
npm run dev
```

`npm run dev` starts Vite and launches the Electron desktop app.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Electron development app. |
| `npm run dev:vite` | Start only the Vite server for browser debugging. |
| `npm run build` | Type-check and build the renderer. |
| `npm run start` | Launch Electron against the production `dist` build. |
| `npm run build:electron` | Build the Windows unpacked app and NSIS installer. |
| `npm run lint` | Run ESLint. |

## Windows Distribution

```powershell
npm run build:electron
```

Build outputs are written to `project/electron/`:

| Output | Description |
| --- | --- |
| `project/electron/win-unpacked/URDF Builder.exe` | Portable unpacked Windows app. |
| `project/electron/URDF-Builder-Setup-0.0.0.exe` | NSIS installer. |

The distribution folder is intentionally ignored by Git.

## Repository Hygiene

The project keeps generated and local-only files out of source control:

| Ignored | Why |
| --- | --- |
| `node_modules/`, `dist/`, `dist-ssr/` | Dependency and build output. |
| `project/`, `.release/` | Packaged Electron artifacts. |
| `.agents/`, `.prompts/`, `.idea/` | Local agent memory, prompts, and IDE metadata. |
| `.env*`, logs, caches, temporary files | Machine-specific runtime data. |

## Roadmap

| Focus | Notes |
| --- | --- |
| Xacro workflow | Better package-level authoring and preprocessing. |
| More mesh formats | OBJ, GLB, and GLTF loader support. |
| Advanced controllers | Richer ROS control previews and authored controller metadata. |
| Editor persistence | Full save support for non-URDF tabs and workspace side files. |
| Performance | Route/editor code splitting for the Monaco and Three.js bundle. |

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE).

<div align="center">
  <sub>Built for robot builders who want the XML, the model, and the viewport to stay in one calm workspace.</sub>
</div>
