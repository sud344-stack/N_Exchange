#!/bin/bash
cd frontend && npm run build
cd ../backend && ./target/release/backend
