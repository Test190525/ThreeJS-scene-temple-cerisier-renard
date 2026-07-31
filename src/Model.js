import React from "react";
import { useGLTF } from "@react-three/drei";

// Composant pour un modèle statique (sans animation)
// Props : url du fichier .glb, position, rotation (en radians) et scale dans la scène
export default function Model({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}) {
  const { scene } = useGLTF(url);

  // On clone la scène pour pouvoir afficher plusieurs fois le même modèle
  // (sinon le même objet 3D ne peut pas être rendu à deux endroits)
  return (
    <primitive
      object={scene.clone()}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
}
