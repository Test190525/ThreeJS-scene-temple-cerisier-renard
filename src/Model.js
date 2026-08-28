import React, { useMemo } from "react";
import { useGLTF } from "@react-three/drei";

// Modèle statique chargé depuis un .glb
export default function Model({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}) {
  const { scene } = useGLTF(url);

  // Clone mémoïsé (le même objet 3D ne peut pas être rendu deux fois), ombres activées
  const model = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return (
    <primitive
      object={model}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
}
