import React, { useRef } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";

// Composant pour un modèle animé : useGLTF charge le modèle + ses animations,
// useAnimations donne accès aux "actions" (les animations jouables).
export default function AnimatedModel({ url, position = [0, 0, 0], scale = 1 }) {
  const group = useRef();
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, group);

  // Au clic, on démarre la première animation disponible dans le fichier .glb
  const handleClick = () => {
    const firstAction = actions[names[0]];
    firstAction?.reset().play();
  };

  return (
    <group ref={group} position={position} onClick={handleClick}>
      <primitive object={scene} scale={scale} />
    </group>
  );
}
