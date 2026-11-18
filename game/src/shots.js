// Screenshot staging: ?shot=<scene> poses real gameplay for the entry's
// screenshots. Nothing is faked — the same systems run; the scene only places
// Dario, his car and the Palmshade PD where the camera can see the game.

export function applyShotScene(name, ctx) {
  const { player, camera, wanted, police, missions, traffic, givePlayerCar } = ctx;
  if (name === 'chase') {
    // Cover: a four-star chase east along Harbor Avenue at dusk.
    const car = givePlayerCar('solstice', 0xc22e2e, -30, 30, Math.PI / 2);
    car.velX = Math.sin(Math.PI / 2) * 17; car.velZ = 0;
    wanted.forceStars(4);
    police.spawnCopAt(-58, 25.5, Math.PI / 2).velX = 15;
    police.spawnCopAt(-64, 34.5, Math.PI / 2).velX = 15;
    police.spawnCopAt(-72, 30, Math.PI / 2).velX = 14;
    camera.yaw = Math.PI / 2; camera.pitch = 0.3;
    camera.pos.set(car.x - 10.5, 5.2, car.z);
    ctx.setCash(1875);
    missions.index = 2; missions.stage = 1; missions.refreshTarget();
    return;
  }
  if (name === 'foot') {
    // On foot outside the Coral Spoon: peds, traffic, the first golden marker.
    player.place(-112, 28, Math.PI / 2);
    camera.yaw = Math.PI / 2; camera.pitch = 0.3;
    ctx.setCash(140);
    return;
  }
  if (name === 'mission') {
    // Mid-delivery: First Wheels, crate aboard, hotel across the bay in view.
    missions.index = 1; missions.stage = 0; missions.refreshTarget(); missions.timer = 96;
    const car = givePlayerCar('vireo', 0x30455e, 58, -34, Math.PI / 2);
    car.velX = 11; car.velZ = 0;
    camera.yaw = Math.PI / 2; camera.pitch = 0.3;
    ctx.setCash(390);
    return;
  }
  if (name === 'overlook') {
    // The whole city from the beach by the Old Ferry Pier, Dario taking it in.
    player.place(234, 16, -Math.PI / 2 + 0.4);
    camera.yaw = -Math.PI / 2 + 0.4; camera.pitch = 0.14;
    camera.pos.set(241, 3.4, 13);
    ctx.setCash(5240);
    missions.index = 0; missions.stage = 0; missions.refreshTarget();
    return;
  }
  // 'title' and anything else: the start screen over a slow pan of the marina.
  player.place(150, 148, Math.PI);
  camera.yaw = Math.PI * 1.25; camera.pitch = 0.36;
}
