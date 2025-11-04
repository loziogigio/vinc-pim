declare namespace JSX {
  interface IntrinsicElements {
    "model-viewer": ModelViewerJSX & React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
  }
}

interface ModelViewerJSX {
  src?: string;
  alt?: string;
  poster?: string;
  seamlessPoster?: boolean;
  loading?: "auto" | "lazy" | "eager";
  reveal?: "auto" | "interaction" | "manual";
  withCredentials?: boolean;

  // AR
  ar?: boolean;
  arModes?: string;
  arScale?: "auto" | "fixed";
  arPlacement?: "floor" | "wall";
  iosSrc?: string;

  // Staging & Cameras
  cameraControls?: boolean;
  cameraOrbit?: string;
  cameraTarget?: string;
  fieldOfView?: string;
  maxCameraOrbit?: string;
  minCameraOrbit?: string;
  maxFieldOfView?: string;
  minFieldOfView?: string;
  bounds?: "tight" | "legacy";
  interpolationDecay?: number;

  // Lighting & Env
  skyboxImage?: string;
  environmentImage?: string;
  exposure?: string;
  shadowIntensity?: string;
  shadowSoftness?: string;

  // Animation
  animationName?: string;
  animationCrossfadeDuration?: number;
  autoplay?: boolean;
  autoRotate?: boolean;
  autoRotateDelay?: number;
  rotationPerSecond?: string;

  // Materials & Rendering
  variantName?: string;
  orientation?: string;
  scale?: string;

  // Interaction
  interactionPrompt?: "auto" | "none";
  interactionPromptStyle?: "basic" | "wiggle";
  interactionPromptThreshold?: number;

  // Annotations
  disableZoom?: boolean;
  disablePan?: boolean;
  disableTap?: boolean;

  // Slots for children
  slot?: string;
  ref?: React.Ref<HTMLElement>;
}
