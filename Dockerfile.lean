# Use a standard, stable Ubuntu base image
FROM ubuntu:22.04

# Avoid timezone interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install required dependencies (curl and git are needed for elan)
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set up environment variables for Elan (Lean's version manager)
ENV ELAN_HOME="/root/.elan"
ENV PATH="${ELAN_HOME}/bin:${PATH}"

# Download and install Elan and the stable Lean 4 toolchain automatically
RUN curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh -s -- -y --default-toolchain leanprover/lean4:stable

# Create the sandbox directory for NeuroSyn-Math to mount files into
WORKDIR /proof_sandbox

# Verify installation
RUN lean --version