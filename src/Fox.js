import { useEffect, useMemo, useRef } from "react";
import { useGLTF, useAnimations, useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";

const FOX_URL = "/model/moving-fox.glb";

useGLTF.preload(FOX_URL);

// Extrémités mesurées sur les clips Idle/Walk/Gallop, skinning appliqué (échelle 1)
const HALF_EXTENTS = [0.665, 1.561, 2.965];
// Hauteur du centre de la boîte au-dessus des pattes
const CENTER_Y = 1.506;

export default function Fox({
  position = [0, 2, 13],
  scale = 0.5,
  walkSpeed = 2.5,
  runSpeed = 6,
  turnSpeed = 2.5,
  onMove,
}) {
  const body = useRef();
  const visual = useRef();
  const clip = useRef("Idle");
  // Cap du renard, appliqué au corps physique pour que la boîte pivote avec lui
  const heading = useRef(Math.PI);

  const { scene, animations } = useGLTF(FOX_URL);
  const { actions } = useAnimations(animations, visual);
  const [, getKeys] = useKeyboardControls();

  // Demi-dimensions du collider ; mémoïsées pour ne pas le recréer à chaque rendu
  const half = useMemo(() => HALF_EXTENTS.map((v) => v * scale), [scale]);

  // Animation d'attente au démarrage
  useEffect(() => {
    actions.Idle?.reset().fadeIn(0.3).play();
  }, [actions]);

  // Le .glb arrive avec castShadow à false
  useEffect(() => {
    scene.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
  }, [scene]);

  // Enchaîne deux clips en fondu croisé
  const play = (name) => {
    if (clip.current === name) return;
    actions[clip.current]?.fadeOut(0.2);
    actions[name]?.reset().fadeIn(0.2).play();
    clip.current = name;
  };

  useFrame((state, delta) => {
    if (!body.current) return;
    const { forward, backward, left, right, run } = getKeys();

    // Gauche/droite : pivote sur place
    const turn = (left ? 1 : 0) - (right ? 1 : 0);
    if (turn) heading.current += turn * turnSpeed * delta;
    const h = heading.current;
    body.current.setRotation(
      { x: 0, y: Math.sin(h / 2), z: 0, w: Math.cos(h / 2) },
      true
    );

    // Avant/arrière : avance dans son cap, pas selon les axes du monde
    const drive = (forward ? 1 : 0) - (backward ? 1 : 0);
    const speed = drive * (run && drive > 0 ? runSpeed : walkSpeed);

    // On n'écrase que X et Z : garder v.y laisse Rapier appliquer la gravité
    const v = body.current.linvel();
    body.current.setLinvel(
      {
        x: Math.sin(h) * speed,
        y: v.y,
        z: Math.cos(h) * speed,
      },
      true
    );

    // Clip choisi d'après l'action ; joué à l'envers quand il recule
    const name = drive > 0 ? (run ? "Gallop" : "Walk") : drive < 0 || turn ? "Walk" : "Idle";
    play(name);
    if (actions[name]) actions[name].timeScale = drive < 0 ? -1 : 1;

    // Position et cap, relus par la caméra
    onMove?.(body.current.translation(), h);
  });

  return (
    // Seul corps dynamique de la scène ; lockRotations l'empêche de basculer
    <RigidBody
      ref={body}
      position={position}
      colliders={false}
      mass={1}
      friction={1}
      restitution={0.6}
      lockRotations
    >
      <CuboidCollider args={half} />
      <group ref={visual} position={[0, -CENTER_Y * scale, 0]}>
        <primitive object={scene} scale={scale} />
      </group>
    </RigidBody>
  );
}
