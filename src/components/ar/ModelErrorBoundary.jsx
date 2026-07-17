import React from 'react';
import { Html } from '@react-three/drei';

// A single malformed/missing/mismatched asset shouldn't take down the whole
// Canvas — the catalog mixes .glb, .obj+.mtl and flat PNGs across categories.
export default class ModelErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('AR model failed to load/render:', error);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Html center>
          <div className="configurator-loader configurator-loader--error">
            ⚠️ Couldn't load this model
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
}
