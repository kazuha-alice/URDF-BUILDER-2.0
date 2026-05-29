# URDF-BUILDER-2.0

**URDF-BUILDER-2.0** is a visual robot design and prototyping platform that enables users to create, configure, validate, and export robot models without writing URDF manually.

The platform is designed for robotics engineers, students, researchers, and simulation developers who need a faster workflow for building robot architectures for ROS, Gazebo, RViz, and NVIDIA Isaac Sim.

## Features

* Visual robot assembly through an intuitive UI
* Support for:

  * Mobile Robots (AMR/AGV)
  * Differential Drive Robots
  * Skid-Steer / Tank Drive Platforms
  * Manipulators and Robotic Arms
  * Custom Hybrid Robots
* Automatic URDF generation
* Joint and link configuration
* Sensor integration (LiDAR, Camera, IMU, GPS, Ultrasonic, etc.)
* Wheel and drive system configuration
* Controller testing environment
* Real-time robot preview
* ROS-compatible robot exports
* NVIDIA Isaac Sim compatible workflows
* Custom robot architecture creation
* Validation checks before export

## Built-In Controllers

### Differential Drive

* Forward and reverse motion
* Curved trajectories using wheel speed differences
* In-place rotation
* Left and right wheel independent control

### Skid Steering / Tank Drive

* Independent track or wheel side control
* Suitable for AMRs, AGVs, UGVs, and industrial robots

### Advanced Controller

* Combination of:

  * Differential Drive
  * Multi-DOF Joint Control

Designed for complex robotic systems that combine mobile navigation and manipulators.

## Safety-First Validation

The builder prevents invalid controller configurations from crashing simulations.

Instead of throwing exceptions, unsupported configurations are safely ignored when minimum controller requirements are not met.

Examples:

### Differential Drive

Minimum Requirement:

* 1 wheel pair

Supported:

* Forward
* Backward

### FBLH Controller

Supported:

* 2 to 6 wheels

Beyond this range:

* Users can still build and export the robot.
* Custom controllers must be implemented in ROS, Gazebo, Isaac Sim, or other robotics frameworks.

## Target Ecosystem

* ROS 1
* ROS 2
* RViz
* Gazebo
* NVIDIA Isaac Sim
* Isaac Lab
* MoveIt
* Custom Robotics Simulators

## Goal

URDF-BUILDER-2.0 reduces the complexity of robot modeling by providing a visual workflow for robot creation while remaining fully compatible with professional robotics simulation and deployment pipelines.

---

**Build Robots Visually. Export Anywhere. Simulate Everywhere.** 🚀

`COMING SOON`
