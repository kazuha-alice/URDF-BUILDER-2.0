<div align="center">
  <img src="src/icons/urdf-builder.png" alt="URDF Builder logo" width="84" />

  <h1>URDF Builder 2.0</h1>

  <p>
    A modern Electron workbench for authoring, inspecting, transforming, and packaging URDF robot descriptions.
  </p>

  <p>
    <img alt="Electron" src="https://img.shields.io/badge/Electron-42-5ad7cf?style=for-the-badge&logo=electron&logoColor=0f1720" />
    <img alt="React" src="https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=0f1720" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178c6?style=for-the-badge&logo=typescript&logoColor=white" />
    <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646cff?style=for-the-badge&logo=vite&logoColor=white" />
    <img alt="Three.js" src="https://img.shields.io/badge/Three.js-Viewport-111827?style=for-the-badge&logo=threedotjs&logoColor=white" />
  </p>
</div>

<br />

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="readme_assets/01.png" />
  <img src="readme_assets/01.png" alt="URDF Builder dashboard with template gallery and recent projects" width="100%" />
</picture>

## One UI Inspired Robotics Workspace

URDF Builder 2.0 is shaped like a desktop robotics studio instead of a plain XML editor. It combines a soft One UI-inspired shell, a CAD-style 3D viewport, Monaco editing, robot hierarchy tools, diagnostics, timeline history, and native Electron file workflows.

<table>
  <tr>
    <td width="33%">
      <strong>Modern Startup</strong><br />
      Dashboard-first launch with templates, recent robots, draft recovery, native open flows, and fast access to URDF workspaces.
    </td>
    <td width="33%">
      <strong>Robotics CAD Viewport</strong><br />
      Three.js viewport with grid, axes, transform tools, local/world modes, snapping, visibility layers, and selection outlines.
    </td>
    <td width="33%">
      <strong>Editor Workbench</strong><br />
      Dockable panels, Monaco tabs, XML outline, timeline, diagnostics, controller preview, and detached Electron windows.
    </td>
  </tr>
</table>

## Preview

<table>
  <tr>
    <td>
      <img src="readme_assets/02.png" alt="URDF Builder viewport with hierarchy, transform gizmo, inspector, and controller panel" />
    </td>
  </tr>
  <tr>
    <td align="center"><strong>Dockable workbench with viewport, hierarchy, inspector, and controller panels</strong></td>
  </tr>
</table>

<table>
  <tr>
    <td width="50%">
      <img src="readme_assets/03.png" alt="Native Windows URDF open dialog inside URDF Builder" />
    </td>
    <td width="50%">
      <img src="readme_assets/04.png" alt="Loaded AMR URDF robot with mesh rendering, outline, sensors, and transform controls" />
    </td>
  </tr>
  <tr>
    <td align="center"><strong>Native Electron file workflow</strong></td>
    <td align="center"><strong>Loaded AMR robot with visual and collision layers</strong></td>
  </tr>
</table>

> Full motion preview: [readme_assets/_001.mp4](readme_assets/_001.mp4)

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
