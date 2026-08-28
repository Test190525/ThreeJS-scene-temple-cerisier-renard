import React, { useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

const LAMP_URL = "/model/stone-lamp.glb";

useGLTF.preload(LAMP_URL);

// Relevé dans le .glb : le pivot n'est pas à la base, il faut remonter le modèle
const BASE_OFFSET = 2.1929;
// Chambre à feu (hi-bukuro), fermée dans le modèle : on plaque 4 vitres émissives devant
const FIREBOX_Y = 0.175;
const FIREBOX_HALF = 0.25;
const WINDOW_W = 0.3;
const WINDOW_H = 0.34;

// Les 4 faces de la chambre à feu
const WINDOWS = [
  { position: [0, FIREBOX_Y, FIREBOX_HALF], rotation: [0, 0, 0] },
  { position: [0, FIREBOX_Y, -FIREBOX_HALF], rotation: [0, Math.PI, 0] },
  { position: [FIREBOX_HALF, FIREBOX_Y, 0], rotation: [0, Math.PI / 2, 0] },
  { position: [-FIREBOX_HALF, FIREBOX_Y, 0], rotation: [0, -Math.PI / 2, 0] },
];

// Lanterne de pierre : le .glb ne fournit que la pierre, la flamme est ajoutée ici
export default function StoneLamp({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 0.6,
  color = "#ffb861",
  glow = 4.5, // > 1 : dépasse le seuil de luminance du Bloom
  lightIntensity = 7.5,
  flicker = false,
  night, // ref : 0 en plein jour, 1 la nuit. Absent => toujours allumée
}) {
  const { scene } = useGLTF(LAMP_URL);
  // Clone mémoïsé, avec les ombres activées sur la pierre
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

  const lightRef = useRef();
  const matRefs = useRef([]);

  // Hauteur de la flamme ; le pointLight reste hors du groupe mis à l'échelle
  const flameWorldY = (BASE_OFFSET + FIREBOX_Y) * scale;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // f : vacillement, deux sinus non harmoniques. n : montée à la tombée du jour
    const f = flicker ? 0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 2.1) : 1;
    const n = night ? night.current : 1;
    if (lightRef.current) lightRef.current.intensity = lightIntensity * f * n;
    matRefs.current.forEach((m) => {
      if (m) m.emissiveIntensity = glow * f * n;
    });
  });

  return (
    <group position={position} rotation={rotation}>
      <group scale={scale} position={[0, BASE_OFFSET * scale, 0]}>
        <primitive object={model} />

        {/* Les 4 vitres lumineuses collées sur la chambre à feu */}
        {WINDOWS.map((w, i) => (
          <mesh key={i} position={w.position} rotation={w.rotation}>
            <planeGeometry args={[WINDOW_W, WINDOW_H]} />
            <meshStandardMaterial
              ref={(m) => (matRefs.current[i] = m)}
              color="#000000"
              emissive={color}
              emissiveIntensity={glow}
              // sans ça le tone mapping ramène la couleur sous le seuil du Bloom
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      {/* La lumière projetée sur le sol et les modèles voisins */}
      <pointLight
        ref={lightRef}
        position={[0, flameWorldY, 0]}
        color={color}
        intensity={lightIntensity}
        distance={7}
        decay={2}
      />
    </group>
  );
}
