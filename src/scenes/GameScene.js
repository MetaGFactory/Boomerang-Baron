export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        // Level system
        this.level = data.level || 1;
        this.wave = 1;
        this.wavesPerLevel = 3;
        this.waveInProgress = false;

        // Player stats
        this.lives = 3;
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.score = data.score || 0;
        this.isInvincible = false;
        this.isDead = false;
        this.isCrashing = false;

        // Movement
        this.playerSpeed = 250;
        this.playerX = 100; // Fixed X position

        // Boomerang system
        this.boomerangPower = 1;
        this.maxBoomerangPower = 5;
        this.activeBoomerangs = [];
        this.lastBoomerangTime = 0;
        this.boomerangCooldown = 400;

        // Coconut bomb
        this.lastCoconutTime = 0;
        this.coconutCooldown = 800;

        // Pineapple grenade
        this.pineappleCount = 3;
        this.lastPineappleTime = 0;
        this.pineappleCooldown = 1000;

        // Boss state
        this.bossActive = false;
        this.boss = null;
        this.bossHP = 0;
        this.bossMaxHP = 0;

        // Paratrooper system
        this.lastParatrooperTime = 0;
        this.paratrooperSpawnDelay = 8000; // Spawn every 8 seconds

        // Helper planes (rescued paratroopers become wingmen)
        this.helperPlanes = [];
        this.maxHelpers = 3;
    }

    create() {
        // Create backgrounds
        this.createBackgrounds();

        // Create player
        this.createPlayer();

        // Create physics groups
        this.boomerangs = this.physics.add.group();
        this.coconuts = this.physics.add.group();
        this.pineapples = this.physics.add.group();
        this.enemyBullets = this.physics.add.group();
        this.enemies = this.physics.add.group();
        this.turrets = this.physics.add.group();
        this.explosions = this.add.group();

        // Paratrooper and helper groups
        this.paratroopers = this.physics.add.group();
        this.helperBullets = this.physics.add.group();

        // Setup input
        this.setupInput();

        // Setup collisions
        this.physics.add.overlap(this.boomerangs, this.enemies, this.hitEnemyWithBoomerang, null, this);
        this.physics.add.overlap(this.coconuts, this.enemies, this.hitEnemyWithCoconut, null, this);
        this.physics.add.overlap(this.coconuts, this.turrets, this.hitTurretWithCoconut, null, this);
        this.physics.add.overlap(this.pineapples, this.enemies, this.hitEnemyWithPineapple, null, this);
        this.physics.add.overlap(this.player, this.enemies, this.playerHitByEnemy, null, this);
        this.physics.add.overlap(this.player, this.enemyBullets, this.playerHitByBullet, null, this);

        // Paratrooper capture collision
        this.physics.add.overlap(this.player, this.paratroopers, this.captureParatrooper, null, this);

        // Helper bullet collisions
        this.physics.add.overlap(this.helperBullets, this.enemies, this.helperBulletHitEnemy, null, this);

        // Create UI
        this.createUI();

        // Start overworld music
        this.overworldMusic = this.sound.add('overworld-theme', { loop: true, volume: 0.6 });
        this.overworldMusic.play();

        // Show level intro
        this.showLevelIntro();
    }

    // ============== BACKGROUNDS ==============

    createBackgrounds() {
        // Determine which scene to use based on level
        const sceneNum = Math.min(this.level, 3);

        this.bgLayer = this.add.tileSprite(0, 0, 800, 450, `scene${sceneNum}-bg`)
            .setOrigin(0, 0)
            .setDepth(1);  // Furthest back

        this.midLayer = this.add.tileSprite(0, 450, 1600, 450, `scene${sceneNum}-mid`)  // Width compensated for 0.5 scale
            .setOrigin(0, 1)  // Bottom-left origin
            .setDepth(2)
            .setScale(0.5);  // Uniform scale down by 50%

        this.fgLayer = this.add.tileSprite(0, 315, 800, 135, `scene${sceneNum}-fg`)  // Bottom portion only
            .setOrigin(0, 0)
            .setDepth(3);  // In front of midground

        // Base scroll speed (increases with level)
        this.baseScrollSpeed = 1 + (this.level * 0.15);

        // Parallax speed multipliers
        this.bgScrollSpeed = 0.15;   // Background: slowest
        this.midScrollSpeed = 0.45;  // Midground: medium
        this.fgScrollSpeed = 1.0;    // Foreground: matches gameplay
    }

    // ============== PLAYER ==============

    createPlayer() {
        this.player = this.physics.add.sprite(100, 225, 'biplane');
        this.player.setScale(0.35); // 344x344 scaled down to ~120px
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(10);
        this.player.body.setSize(280, 180);  // Hitbox relative to full sprite size
        this.player.body.setOffset(24, 23);
    }

    setupInput() {
        // Keyboard
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.fKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        this.qKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
        this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

        // Mouse tracking for pineapple grenade
        this.input.on('pointermove', (pointer) => {
            this.mouseX = pointer.x;
            this.mouseY = pointer.y;
        });

        // Mouse click for boomerang
        this.mouseClicked = false;
        this.input.on('pointerdown', (pointer) => {
            if (pointer.leftButtonDown()) {
                this.mouseClicked = true;
            }
            // Touch controls
            this.touchY = pointer.y;
            this.playerStartY = this.player.y;
        });

        this.input.on('pointermove', (pointer) => {
            if (pointer.isDown && !this.isDead) {
                const deltaY = pointer.y - this.touchY;
                this.player.y = Phaser.Math.Clamp(this.playerStartY + deltaY, 50, 400);
            }
        });
    }

    // ============== UI ==============

    createUI() {
        // Score
        this.scoreText = this.add.text(16, 16, 'SCORE: ' + this.score, {
            fontFamily: 'monospace',
            fontSize: '18px',
            fill: '#fff',
            stroke: '#000',
            strokeThickness: 3
        }).setDepth(100);

        // Level & Wave
        this.levelText = this.add.text(400, 16, `LEVEL ${this.level} - WAVE ${this.wave}`, {
            fontFamily: 'monospace',
            fontSize: '18px',
            fill: '#ffcc00',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5, 0).setDepth(100);

        // Lives
        this.livesText = this.add.text(700, 16, '❤️ x ' + this.lives, {
            fontFamily: 'monospace',
            fontSize: '18px',
            fill: '#ff3333',
            stroke: '#000',
            strokeThickness: 3
        }).setDepth(100);

        // Health bar background (at top of screen)
        this.healthBarBg = this.add.rectangle(400, 45, 300, 16, 0x333333).setDepth(100);
        this.healthBar = this.add.rectangle(252, 45, 294, 12, 0x00ff00)
            .setOrigin(0, 0.5).setDepth(100);
        this.add.rectangle(400, 45, 300, 16).setStrokeStyle(2, 0xffffff).setDepth(100);

        // Boomerang power indicator
        this.powerText = this.add.text(16, 410, '🍌 POWER: ' + '●'.repeat(this.boomerangPower) + '○'.repeat(this.maxBoomerangPower - this.boomerangPower), {
            fontFamily: 'monospace',
            fontSize: '14px',
            fill: '#ffdd00',
            stroke: '#000',
            strokeThickness: 2
        }).setDepth(100);

        // Pineapple count
        this.pineappleText = this.add.text(650, 410, '🍍 x ' + this.pineappleCount, {
            fontFamily: 'monospace',
            fontSize: '14px',
            fill: '#00ff00',
            stroke: '#000',
            strokeThickness: 2
        }).setDepth(100);

        // Announcement text
        this.announceText = this.add.text(400, 200, '', {
            fontFamily: 'monospace',
            fontSize: '36px',
            fill: '#fff',
            stroke: '#000',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(100).setAlpha(0);

        // Boss health bar (hidden initially)
        this.createBossHealthBar();
    }

    createBossHealthBar() {
        this.bossHealthContainer = this.add.container(400, 50).setDepth(100).setVisible(false);

        const label = this.add.text(0, -18, 'BOSS', {
            fontFamily: 'monospace',
            fontSize: '14px',
            fill: '#ff0000',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5);

        const bg = this.add.rectangle(0, 0, 400, 20, 0x333333);
        this.bossHealthBar = this.add.rectangle(-198, 0, 396, 16, 0xff0000).setOrigin(0, 0.5);
        const border = this.add.rectangle(0, 0, 400, 20).setStrokeStyle(2, 0xffffff);

        this.bossHealthContainer.add([label, bg, this.bossHealthBar, border]);
    }

    // ============== GAME LOOP ==============

    update(time) {
        if (this.isDead) return;

        // Scroll parallax backgrounds (3 layers at different speeds)
        this.bgLayer.tilePositionX += this.baseScrollSpeed * this.bgScrollSpeed;
        this.midLayer.tilePositionX += this.baseScrollSpeed * this.midScrollSpeed;
        this.fgLayer.tilePositionX += this.baseScrollSpeed * this.fgScrollSpeed;

        // Player movement
        this.handlePlayerMovement();

        // Update player animation based on movement
        this.updatePlayerAnimation();

        // Low health smoke effect
        if (this.health < this.maxHealth * 0.3 && !this.isCrashing && this.player.active) {
            if (!this.lastSmokeTime) this.lastSmokeTime = 0;
            if (time > this.lastSmokeTime + 100) {
                this.createDamageSmoke();
                this.lastSmokeTime = time;
            }
        }

        // Weapons
        this.handleBoomerang(time);
        this.handleCoconut(time);
        this.handlePineapple(time);

        // Update active boomerangs
        this.updateBoomerangs();

        // Update enemies
        this.updateEnemies(time);

        // Update turrets
        this.updateTurrets(time);

        // Update enemy bullets (spinning eggs, etc.)
        this.updateEnemyBullets();

        // Spawn paratroopers periodically
        if (time > this.lastParatrooperTime + this.paratrooperSpawnDelay && !this.bossActive) {
            this.spawnParatrooper();
            this.lastParatrooperTime = time;
        }

        // Update paratroopers
        this.updateParatroopers();

        // Update helper planes
        this.updateHelperPlanes(time);

        // Boss update
        if (this.bossActive && this.boss) {
            this.updateBoss(time);
        }

        // Cleanup
        this.cleanupOffscreen();

        // Check wave complete
        if (!this.bossActive) {
            this.checkWaveComplete();
        }
    }

    createDamageSmoke() {
        const smoke = this.add.circle(
            this.player.x - 40 + Phaser.Math.Between(-5, 5),
            this.player.y + Phaser.Math.Between(-3, 3),
            Phaser.Math.Between(4, 8),
            0x555555,
            0.6
        );
        smoke.setDepth(7);
        this.tweens.add({
            targets: smoke,
            alpha: 0,
            scale: 1.5,
            x: smoke.x - 40,
            duration: 400,
            onComplete: () => smoke.destroy()
        });
    }

    updatePlayerAnimation() {
        if (!this.player.anims) return;

        const vel = this.player.body.velocity;
        if (this.health < this.maxHealth * 0.3) {
            this.player.play('biplane-damaged', true);
        } else if (vel.y < -50) {
            this.player.play('biplane-up', true);
        } else if (vel.y > 50) {
            this.player.play('biplane-down', true);
        } else {
            this.player.play('biplane-idle', true);
        }
    }

    handlePlayerMovement() {
        // No movement during crash sequence
        if (this.isCrashing) return;

        const { up, down, left, right } = this.cursors;
        let velocityX = 0;
        let velocityY = 0;

        // Vertical movement
        if (up.isDown || this.wasd.up.isDown) velocityY = -this.playerSpeed;
        else if (down.isDown || this.wasd.down.isDown) velocityY = this.playerSpeed;

        // Horizontal movement (A/D or Left/Right arrows)
        if (left.isDown || this.wasd.left.isDown) velocityX = -this.playerSpeed;
        else if (right.isDown || this.wasd.right.isDown) velocityX = this.playerSpeed;

        this.player.setVelocity(velocityX, velocityY);

        // Clamp X position to stay within play area (not too far left or right)
        this.player.x = Phaser.Math.Clamp(this.player.x, 50, 700);
    }

    // ============== WEAPONS ==============

    handleBoomerang(time) {
        // Mouse click to fire boomerang
        if (this.mouseClicked && time > this.lastBoomerangTime + this.boomerangCooldown) {
            this.fireBoomerang();
            this.lastBoomerangTime = time;
        }
        this.mouseClicked = false; // Reset after checking
    }

    fireBoomerang() {
        // Play banana whip sound at 15% volume
        this.sound.play('banana-whip', { volume: 0.15 });

        const boomerang = this.boomerangs.create(this.player.x + 30, this.player.y, 'boomerang');
        boomerang.setScale(0.8 + (this.boomerangPower * 0.1));
        boomerang.setDepth(5);
        boomerang.power = this.boomerangPower;
        boomerang.startX = this.player.x + 30;
        boomerang.maxDistance = 350 + (this.boomerangPower * 50);
        boomerang.outbound = true;
        boomerang.speed = 6 + this.boomerangPower;
        boomerang.body.setSize(60, 60); // Larger hitbox for reliable collision

        this.activeBoomerangs.push(boomerang);
    }

    updateBoomerangs() {
        this.activeBoomerangs = this.activeBoomerangs.filter(boomerang => {
            if (!boomerang.active) return false;

            // Spin animation
            boomerang.angle += 15;

            if (boomerang.outbound) {
                boomerang.x += boomerang.speed;
                if (boomerang.x > boomerang.startX + boomerang.maxDistance) {
                    boomerang.outbound = false;
                }
            } else {
                boomerang.x -= boomerang.speed * 0.8;

                // Check for catch
                if (Phaser.Geom.Intersects.RectangleToRectangle(
                    boomerang.getBounds(),
                    this.player.getBounds()
                )) {
                    // Caught! Power up!
                    this.boomerangPower = Math.min(this.boomerangPower + 1, this.maxBoomerangPower);
                    this.updatePowerDisplay();
                    this.showCatchEffect();
                    boomerang.destroy();
                    return false;
                }

                // Missed catch - POWER RESETS TO ZERO!
                if (boomerang.x < -50) {
                    // Reset power completely if missed
                    this.boomerangPower = 0;
                    this.updatePowerDisplay();
                    this.showMissEffect();
                    boomerang.destroy();
                    return false;
                }
            }

            return true;
        });
    }

    showCatchEffect() {
        const text = this.add.text(this.player.x + 50, this.player.y - 40, 'POWER UP!', {
            fontFamily: 'monospace',
            fontSize: '20px',
            fill: '#ffdd00',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(100);

        this.tweens.add({
            targets: text,
            y: text.y - 40,
            alpha: 0,
            duration: 800,
            onComplete: () => text.destroy()
        });

        // Flash player
        this.player.setTint(0xffff00);
        this.time.delayedCall(100, () => this.player.clearTint());
    }

    showMissEffect() {
        const text = this.add.text(50, this.player.y, 'POWER LOST!', {
            fontFamily: 'monospace',
            fontSize: '18px',
            fill: '#ff4444',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(100);

        this.tweens.add({
            targets: text,
            y: text.y - 30,
            alpha: 0,
            duration: 600,
            onComplete: () => text.destroy()
        });

        // Flash player red
        this.player.setTint(0xff0000);
        this.time.delayedCall(100, () => this.player.clearTint());
    }

    updatePowerDisplay() {
        this.powerText.setText('🍌 POWER: ' + '●'.repeat(this.boomerangPower) + '○'.repeat(this.maxBoomerangPower - this.boomerangPower));
    }

    handleCoconut(time) {
        // Spacebar to drop coconut
        if (this.spaceKey.isDown && time > this.lastCoconutTime + this.coconutCooldown) {
            this.dropCoconut();
            this.lastCoconutTime = time;
        }
    }

    dropCoconut() {
        // Play coconut bomb sound at reduced volume
        this.sound.play('coconut-bomb', { volume: 0.17 });

        const coconut = this.coconuts.create(this.player.x, this.player.y + 20, 'coconut');
        coconut.setScale(1.0);
        coconut.setDepth(5);
        coconut.setVelocityY(300); // Falls straight down
        coconut.body.setSize(30, 30); // Proper hitbox
    }

    handlePineapple(time) {
        if ((this.qKey.isDown || this.eKey.isDown) &&
            time > this.lastPineappleTime + this.pineappleCooldown &&
            this.pineappleCount > 0) {
            this.throwPineapple();
            this.lastPineappleTime = time;
        }
    }

    throwPineapple() {
        // Play pineapple shoot sound at increased volume
        this.sound.play('pineapple-shoot', { volume: 0.375 });

        this.pineappleCount--;
        this.pineappleText.setText('🍍 x ' + this.pineappleCount);

        const pineapple = this.pineapples.create(this.player.x + 20, this.player.y, 'pineapple');
        pineapple.setScale(1.0);
        pineapple.setDepth(5);
        pineapple.body.setSize(40, 50); // Proper hitbox

        // Calculate angle to mouse
        const angle = Phaser.Math.Angle.Between(
            this.player.x, this.player.y,
            this.mouseX || 400, this.mouseY || 225
        );

        pineapple.setVelocity(
            Math.cos(angle) * 400,
            Math.sin(angle) * 400
        );

        // Explode after 1 second or on hit
        pineapple.explosionTimer = this.time.delayedCall(1000, () => {
            if (pineapple.active) {
                this.createExplosion(pineapple.x, pineapple.y, 'large');
                this.damageEnemiesInRadius(pineapple.x, pineapple.y, 80);
                pineapple.destroy();
            }
        });
    }

    damageEnemiesInRadius(x, y, radius) {
        // Damage enemies
        this.enemies.getChildren().forEach(enemy => {
            if (!enemy.active) return;
            const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
            if (dist < radius) {
                enemy.health -= 3;
                if (enemy.health <= 0) {
                    this.destroyEnemy(enemy);
                }
            }
        });

        // Also damage turrets!
        this.turrets.getChildren().forEach(turret => {
            if (!turret.active) return;
            const dist = Phaser.Math.Distance.Between(x, y, turret.x, turret.y);
            if (dist < radius) {
                turret.health -= 3;
                if (turret.health <= 0) {
                    this.createExplosion(turret.x, turret.y, 'large');
                    this.score += 300;
                    this.scoreText.setText('SCORE: ' + this.score);
                    turret.destroy();
                }
            }
        });
    }

    // ============== WAVE SYSTEM ==============

    showLevelIntro() {
        this.announceText.setText(`LEVEL ${this.level}`);
        this.announceText.setAlpha(1);

        this.tweens.add({
            targets: this.announceText,
            alpha: 0,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => {
                this.time.delayedCall(500, () => this.startWave());
            }
        });
    }

    startWave() {
        if (this.wave > this.wavesPerLevel) {
            this.startBossFight();
            return;
        }

        this.waveInProgress = true;
        this.levelText.setText(`LEVEL ${this.level} - WAVE ${this.wave}`);

        this.announceText.setText(`WAVE ${this.wave}`);
        this.announceText.setAlpha(1);
        this.tweens.add({
            targets: this.announceText,
            alpha: 0,
            duration: 1500,
            ease: 'Power2'
        });

        // Spawn enemies
        const enemyCount = 5 + (this.level * 3) + (this.wave * 2);
        this.spawnWaveEnemies(enemyCount);

        // Spawn turrets (waves 2+)
        if (this.wave >= 2) {
            this.spawnTurrets(1 + this.level);
        }
    }

    spawnWaveEnemies(count) {
        let spawned = 0;
        const spawnDelay = Math.max(400, 1000 - (this.level * 100) - (this.wave * 50));

        this.enemySpawnTimer = this.time.addEvent({
            delay: spawnDelay,
            callback: () => {
                if (spawned < count && !this.isDead && !this.bossActive) {
                    this.spawnEnemy();
                    spawned++;
                }
            },
            repeat: count - 1
        });
    }

    spawnEnemy() {
        const y = Phaser.Math.Between(60, 390);
        const rand = Math.random();

        if (rand < 0.4) {
            this.createBirdEnemy(y);
        } else {
            this.createPlaneEnemy(y);
        }
    }

    createBirdEnemy(y) {
        const enemy = this.enemies.create(850, y, 'enemy-bird');
        enemy.setScale(1.0);
        enemy.setDepth(6);  // Above parallax layers
        enemy.play('bird-fly'); // Play flapping animation
        enemy.enemyType = 'bird';
        enemy.health = 1;
        enemy.points = 100;
        enemy.canShoot = true;  // Birds can drop eggs
        enemy.isBird = true;    // Flag for bird-specific shooting
        enemy.lastShot = 0;
        enemy.shootDelay = Phaser.Math.Between(2000, 3500);  // Slower than planes
        enemy.setVelocityX(-150 - (this.level * 20));
        enemy.setVelocityY(Phaser.Math.Between(-30, 30));
        enemy.body.setSize(50, 50); // Proper hitbox size
    }

    createPlaneEnemy(y) {
        const enemy = this.enemies.create(850, y, 'enemy-plane');
        enemy.setScale(1.0);
        enemy.setDepth(6);  // Above parallax layers
        enemy.play('plane-fly'); // Play propeller animation
        enemy.enemyType = 'plane';
        enemy.health = 2;
        enemy.points = 200;
        enemy.canShoot = true;
        enemy.lastShot = 0;
        enemy.shootDelay = Phaser.Math.Between(1500, 2500);
        enemy.setVelocityX(-100 - (this.level * 15));
        enemy.body.setSize(80, 50); // Proper hitbox size
    }

    spawnTurrets(count) {
        for (let i = 0; i < count; i++) {
            this.time.delayedCall(i * 2000, () => {
                if (!this.isDead && !this.bossActive) {
                    const turret = this.turrets.create(
                        Phaser.Math.Between(300, 700),
                        425,
                        'turret'
                    );
                    turret.setScale(1.0);
                    turret.setDepth(6);  // Above parallax layers
                    turret.health = 3;
                    // Set lastShot to current time + initial delay so they don't shoot immediately
                    turret.lastShot = this.time.now + 1500;
                    turret.shootDelay = 1500;
                    turret.body.setSize(50, 80); // Proper hitbox
                    turret.play('turret-idle');
                }
            });
        }
    }

    updateEnemies(time) {
        this.enemies.getChildren().forEach(enemy => {
            if (!enemy.active) return;

            // Remove if off screen
            if (enemy.x < -50) {
                enemy.destroy();
                return;
            }

            // Shooting enemies
            if (enemy.canShoot && time > enemy.lastShot + enemy.shootDelay) {
                if (enemy.isBird) {
                    this.birdShoot(enemy);  // Birds drop eggs
                } else {
                    this.enemyShoot(enemy);  // Planes shoot bullets
                }
                enemy.lastShot = time;
            }
        });
    }

    updateTurrets(time) {
        this.turrets.getChildren().forEach(turret => {
            if (!turret.active) return;

            // Shoot at player
            if (time > turret.lastShot + turret.shootDelay) {
                this.turretShoot(turret);
                turret.lastShot = time;
            }
        });
    }

    enemyShoot(enemy) {
        if (!this.player.active) return;

        // Use bullet for planes - rotate 180 to face left
        const bullet = this.enemyBullets.create(enemy.x - 20, enemy.y, 'bullet');
        bullet.setScale(0.6);
        bullet.setDepth(10);
        bullet.setAngle(180);  // Rotate to point left
        bullet.setVelocityX(-350);
        bullet.body.setSize(30, 15);
    }

    birdShoot(bird) {
        if (!this.player.active) return;

        // Birds drop eggs that spin
        const egg = this.enemyBullets.create(bird.x, bird.y + 20, 'egg');
        egg.setScale(0.8);
        egg.setDepth(10);
        egg.isEgg = true;  // Flag for spinning update
        // Egg moves diagonally down-left toward player area
        egg.setVelocity(-100, 150);
        egg.body.setSize(25, 30);
    }

    turretShoot(turret) {
        if (!this.player.active) return;

        // Turrets fire animated missiles
        const missile = this.enemyBullets.create(turret.x, turret.y - 30, 'turret-missile');
        missile.setScale(0.35);  // Scale down from 192x192
        missile.setDepth(10);
        missile.play('turret-missile-fire');

        // Aim at player
        const angle = Phaser.Math.Angle.Between(
            turret.x, turret.y,
            this.player.x, this.player.y
        );
        missile.setRotation(angle + Math.PI / 2);  // Rotate missile to face direction
        missile.setVelocity(
            Math.cos(angle) * 280,
            Math.sin(angle) * 280
        );
        missile.body.setSize(40, 60);
    }

    updateEnemyBullets() {
        // Update all enemy bullets - spin eggs like banana boomerang
        this.enemyBullets.getChildren().forEach(bullet => {
            if (!bullet.active) return;

            // Spin eggs
            if (bullet.isEgg) {
                bullet.angle += 12;  // Spin similar to banana
            }
        });
    }

    checkWaveComplete() {
        if (!this.waveInProgress) return;

        const spawnDone = !this.enemySpawnTimer ||
            this.enemySpawnTimer.getRepeatCount() === 0;
        const enemiesCleared = this.enemies.countActive() === 0;
        const turretsCleared = this.turrets.countActive() === 0;

        if (spawnDone && enemiesCleared && turretsCleared) {
            this.waveInProgress = false;
            this.wave++;

            // Award pineapple for completing wave
            this.pineappleCount = Math.min(this.pineappleCount + 1, 5);
            this.pineappleText.setText('🍍 x ' + this.pineappleCount);

            this.time.delayedCall(2000, () => {
                if (!this.isDead) this.startWave();
            });
        }
    }

    // ============== PARATROOPER SYSTEM ==============

    spawnParatrooper() {
        // Only spawn if we have room for more helpers
        if (this.helperPlanes.length >= this.maxHelpers) return;

        const x = Phaser.Math.Between(400, 750);
        const paratrooper = this.paratroopers.create(x, -30, 'paratrooper');
        paratrooper.setScale(1.2);
        paratrooper.setDepth(8);
        paratrooper.play('paratrooper-float');
        paratrooper.setVelocityY(60); // Float down slowly
        paratrooper.setVelocityX(-20); // Drift left slightly
        paratrooper.body.setSize(40, 50);

        // Show rescue indicator
        const arrow = this.add.text(x, 30, '↓ RESCUE!', {
            fontFamily: 'monospace',
            fontSize: '12px',
            fill: '#00ff00',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(100);

        this.tweens.add({
            targets: arrow,
            alpha: { from: 1, to: 0.3 },
            duration: 300,
            yoyo: true,
            repeat: 5,
            onComplete: () => arrow.destroy()
        });
    }

    updateParatroopers() {
        this.paratroopers.getChildren().forEach(paratrooper => {
            if (!paratrooper.active) return;

            // Remove if off screen (fell too far or drifted off)
            if (paratrooper.y > 500 || paratrooper.x < -50) {
                paratrooper.destroy();
            }
        });
    }

    captureParatrooper(player, paratrooper) {
        // Destroy paratrooper
        paratrooper.destroy();

        // Show capture effect
        const text = this.add.text(player.x + 60, player.y - 30, 'WINGMAN RESCUED!', {
            fontFamily: 'monospace',
            fontSize: '16px',
            fill: '#00ffff',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(100);

        this.tweens.add({
            targets: text,
            y: text.y - 40,
            alpha: 0,
            duration: 1000,
            onComplete: () => text.destroy()
        });

        // Bonus points
        this.score += 500;
        this.scoreText.setText('SCORE: ' + this.score);

        // Spawn helper plane
        this.spawnHelperPlane();

        // Flash effect
        this.cameras.main.flash(200, 0, 255, 255);

        // Play random rescue voice line
        const rescueSound = Phaser.Math.Between(1, 6);
        this.sound.play(`rescue-${rescueSound}`, { volume: 0.8 });
    }

    spawnHelperPlane() {
        if (this.helperPlanes.length >= this.maxHelpers) return;

        const offsetIndex = this.helperPlanes.length;
        const helper = this.physics.add.sprite(
            this.player.x - 50 - (offsetIndex * 40),
            this.player.y + 30 + (offsetIndex * 25),
            'helper-plane'
        );
        helper.setScale(0.6); // Smaller than player
        helper.setDepth(9);
        helper.play('wingman-idle');
        helper.body.setSize(100, 70);

        helper.health = 1; // Dies in one hit
        helper.lastShot = 0;
        helper.shootDelay = 800; // Slower than player
        helper.offsetX = -50 - (offsetIndex * 40);
        helper.offsetY = 30 + (offsetIndex * 25);
        helper.prevY = helper.y;

        this.helperPlanes.push(helper);

        // Add collision for helper planes being hit by enemy bullets
        this.physics.add.overlap(helper, this.enemyBullets, this.helperHitByBullet, null, this);
        this.physics.add.overlap(helper, this.enemies, this.helperHitByEnemy, null, this);
    }

    updateHelperPlanes(time) {
        this.helperPlanes = this.helperPlanes.filter(helper => {
            if (!helper.active) return false;

            // Follow player in formation
            const targetX = this.player.x + helper.offsetX;
            const targetY = this.player.y + helper.offsetY;

            // Smooth follow
            helper.x += (targetX - helper.x) * 0.1;
            helper.y += (targetY - helper.y) * 0.1;

            // Keep in bounds
            helper.y = Phaser.Math.Clamp(helper.y, 30, 420);

            // Update animation based on vertical movement (match biplane)
            const deltaY = helper.y - (helper.prevY || helper.y);
            if (deltaY < -1) {
                helper.play('wingman-up', true);
            } else if (deltaY > 1) {
                helper.play('wingman-down', true);
            } else {
                helper.play('wingman-idle', true);
            }
            helper.prevY = helper.y;

            // Shoot at enemies
            if (time > helper.lastShot + helper.shootDelay) {
                this.helperShoot(helper);
                helper.lastShot = time;
            }

            return true;
        });
    }

    helperShoot(helper) {
        const bullet = this.helperBullets.create(helper.x + 20, helper.y, 'boomerang');
        bullet.setScale(0.4);
        bullet.setTint(0x88ffff); // Cyan tint to distinguish from player
        bullet.setDepth(5);
        bullet.setVelocityX(350);
        bullet.body.setSize(20, 20);
        bullet.damage = 1; // Weaker than player boomerang
    }

    helperBulletHitEnemy(bullet, enemy) {
        bullet.destroy();
        enemy.health -= 1;

        if (enemy.health <= 0) {
            this.destroyEnemy(enemy);
        } else {
            enemy.setTint(0x88ffff);
            this.time.delayedCall(50, () => {
                if (enemy.active) enemy.clearTint();
            });
        }
    }

    helperHitByBullet(helper, bullet) {
        bullet.destroy();
        this.destroyHelper(helper);
    }

    helperHitByEnemy(helper, enemy) {
        this.destroyHelper(helper);
        // Enemy continues (doesn't die from hitting helper)
    }

    destroyHelper(helper) {
        // Play explode animation frame
        helper.play('wingman-explode');

        // Create explosion effect
        this.createExplosion(helper.x, helper.y, 'small');

        // Show message
        const text = this.add.text(helper.x, helper.y - 20, 'WINGMAN DOWN!', {
            fontFamily: 'monospace',
            fontSize: '12px',
            fill: '#ff4444',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(100);

        this.tweens.add({
            targets: text,
            y: text.y - 30,
            alpha: 0,
            duration: 800,
            onComplete: () => text.destroy()
        });

        // Remove from array and destroy after brief delay to show explode frame
        this.helperPlanes = this.helperPlanes.filter(h => h !== helper);
        this.time.delayedCall(200, () => {
            if (helper.active) helper.destroy();
        });
    }

    // ============== BOSS FIGHT ==============

    startBossFight() {
        this.bossActive = true;

        this.announceText.setText('WARNING!\nBOSS APPROACHING');
        this.announceText.setFill('#ff0000');
        this.announceText.setAlpha(1);

        this.tweens.add({
            targets: this.announceText,
            alpha: { from: 1, to: 0.3 },
            duration: 200,
            yoyo: true,
            repeat: 5,
            onComplete: () => {
                this.announceText.setAlpha(0);
                this.announceText.setFill('#ffffff');
                this.spawnBoss();
            }
        });

        this.cameras.main.shake(500, 0.01);

        // Play zeppelin approach sound
        this.sound.play('zeppelin-approach', { volume: 0.8 });

        // Fade out overworld music and start boss music
        if (this.overworldMusic && this.overworldMusic.isPlaying) {
            this.tweens.add({
                targets: this.overworldMusic,
                volume: 0,
                duration: 1500,
                onComplete: () => {
                    this.overworldMusic.stop();
                }
            });
        }

        // Start boss battle music
        this.bossMusic = this.sound.add('boss-theme', { loop: true, volume: 0.7 });
        this.time.delayedCall(1000, () => {
            this.bossMusic.play();
        });
    }

    spawnBoss() {
        this.boss = this.physics.add.sprite(900, 225, 'boss-zeppelin');
        this.boss.setScale(1.5);
        this.boss.setDepth(5);
        this.boss.body.setSize(245, 205); // Width reduced by additional 70px for left offset
        this.boss.body.setOffset(105, 30); // 105px from left front (35 + 70), 30px from top

        this.bossMaxHP = 500 + (this.level * 200);
        this.bossHP = this.bossMaxHP;
        this.boss.lastShot = 0;
        this.boss.shootDelay = 1500;

        // Enter animation
        this.tweens.add({
            targets: this.boss,
            x: 650,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => {
                this.physics.add.overlap(this.boomerangs, this.boss, this.hitBoss, null, this);
                this.physics.add.overlap(this.coconuts, this.boss, this.hitBossWithCoconut, null, this);
                this.physics.add.overlap(this.pineapples, this.boss, this.hitBossWithPineapple, null, this);
                this.physics.add.overlap(this.player, this.boss, this.playerHitByEnemy, null, this);

                this.bossHealthContainer.setVisible(true);
            }
        });
    }

    updateBoss(time) {
        if (!this.boss || !this.boss.active) return;

        // Initialize boss phase system
        if (!this.bossPhase) {
            this.bossPhase = 'normal';
            this.bossPhaseTimer = time;
            this.bombingPhaseInterval = 12000; // Bombing phase every 12 seconds
        }

        // Phase switching logic
        if (this.bossPhase === 'normal') {
            // Normal phase - regular attacks
            this.updateBossNormalPhase(time);

            // Switch to bombing phase periodically
            if (time > this.bossPhaseTimer + this.bombingPhaseInterval) {
                this.startBombingPhase();
            }
        } else if (this.bossPhase === 'transitioning_up') {
            // Moving to top of screen
            // Wait for tween to complete
        } else if (this.bossPhase === 'bombing') {
            // Bombing phase - rain down bombs
            this.updateBossBombingPhase(time);
        } else if (this.bossPhase === 'transitioning_down') {
            // Moving back to normal position
            // Wait for tween to complete
        }

        // Always update missiles
        this.updateBossMissiles();
    }

    updateBossNormalPhase(time) {
        // Normal hovering movement
        this.boss.y = 225 + Math.sin(time * 0.002) * 100;

        // Regular spread shooting
        if (time > this.boss.lastShot + this.boss.shootDelay) {
            this.bossShoot();
            this.boss.lastShot = time;
        }

        // Missile attack every 3 seconds
        if (!this.boss.lastMissile) this.boss.lastMissile = 0;
        if (time > this.boss.lastMissile + 3000) {
            this.bossFireMissiles();
            this.boss.lastMissile = time;
        }
    }

    startBombingPhase() {
        this.bossPhase = 'transitioning_up';

        // Move boss to top of screen (only bottom 33% visible)
        // Boss sprite height * 1.5 scale, show bottom 33% = Y position above screen
        const topY = -80; // Position so only bottom portion is visible

        this.tweens.add({
            targets: this.boss,
            y: topY,
            x: 400, // Center horizontally
            duration: 1500,
            ease: 'Power2',
            onComplete: () => {
                this.bossPhase = 'bombing';
                this.bombingStartTime = this.time.now;
                this.bombingDuration = 5000; // 5 seconds of bombing
                this.lastBombTime = 0;
            }
        });
    }

    updateBossBombingPhase(time) {
        // Drop bombs randomly every 300ms
        if (time > this.lastBombTime + 300) {
            this.dropBossBomb();
            this.lastBombTime = time;
        }

        // Check if bombing phase is over
        if (time > this.bombingStartTime + this.bombingDuration) {
            this.endBombingPhase();
        }
    }

    dropBossBomb() {
        // Random X position across the screen
        const randomX = Phaser.Math.Between(100, 700);

        const bomb = this.enemyBullets.create(randomX, 50, 'boss-bomb');
        bomb.setScale(0.8);
        bomb.setDepth(15);  // High depth to ensure visibility
        bomb.setVelocityY(350); // Fall straight down
        bomb.body.setSize(30, 30);
    }

    endBombingPhase() {
        this.bossPhase = 'transitioning_down';

        // Return to normal position
        this.tweens.add({
            targets: this.boss,
            y: 225,
            x: 650,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => {
                this.bossPhase = 'normal';
                this.bossPhaseTimer = this.time.now;
            }
        });
    }

    bossShoot() {
        // Spread shot with bullets - rotate 180 to face left
        for (let i = -2; i <= 2; i++) {
            const bullet = this.enemyBullets.create(this.boss.x - 50, this.boss.y + (i * 30), 'bullet');
            bullet.setScale(0.48);  // 0.6 * 0.8 = 0.48 (20% smaller than enemy bullets)
            bullet.setDepth(15);  // High depth to ensure visibility
            bullet.setAngle(180);  // Rotate to face left
            bullet.setVelocity(-350, i * 60);
            bullet.body.setSize(30, 15);
        }
    }

    bossFireMissiles() {
        // Fire missiles from BACK of ship (right side since zeppelin faces left)
        const missileCount = 2 + this.level;
        for (let i = 0; i < missileCount; i++) {
            // Launch from back/right side of the zeppelin
            const missile = this.enemyBullets.create(this.boss.x + 100, this.boss.y, 'boss-missile');
            missile.setScale(1.0);
            missile.setDepth(15);  // High depth to ensure visibility
            missile.isBossMissile = true;

            // Random drop distance before accelerating
            missile.dropDistance = Phaser.Math.Between(50, 150);
            missile.startY = this.boss.y;
            missile.phase = 'dropping';

            // Initial velocity: drift down AND to the right
            const dropSpeed = 60 + (i * 15);
            const rightDrift = 40 + Phaser.Math.Between(10, 40);
            missile.setVelocity(rightDrift, dropSpeed); // Drift right and down
            missile.body.setSize(35, 40);
        }
    }

    updateBossMissiles() {
        this.enemyBullets.getChildren().forEach(bullet => {
            if (!bullet.isBossMissile || !bullet.active) return;

            if (bullet.phase === 'dropping') {
                // Check if dropped enough distance
                if (bullet.y >= bullet.startY + bullet.dropDistance) {
                    bullet.phase = 'accelerating';
                    bullet.setVelocityY(0); // Stop vertical movement
                    bullet.accelerateTimer = 0;
                }
            } else if (bullet.phase === 'accelerating') {
                // Accelerate horizontally to the LEFT while still drifting slightly right initially
                bullet.accelerateTimer = (bullet.accelerateTimer || 0) + 1;

                // Gradual transition: starts drifting right, then accelerates left
                const rightDrift = Math.max(0, 30 - (bullet.accelerateTimer * 3)); // Diminishing right drift
                const leftAccel = Math.min(450, 50 + (bullet.accelerateTimer * 10)); // Increasing left speed

                bullet.setVelocityX(rightDrift - leftAccel); // Net velocity shifts from right to left
            }
        });
    }

    hitBoss(boss, boomerang) {
        const damage = boomerang.power * 10;
        this.bossHP -= damage;

        boomerang.destroy();
        this.activeBoomerangs = this.activeBoomerangs.filter(b => b !== boomerang);

        this.updateBossHealthBar();

        boss.setTint(0xff0000);
        this.time.delayedCall(50, () => boss.clearTint());

        if (this.bossHP <= 0) {
            this.defeatBoss();
        }
    }

    hitBossWithCoconut(boss, coconut) {
        this.bossHP -= 30;
        coconut.destroy();
        this.updateBossHealthBar();

        boss.setTint(0xff0000);
        this.time.delayedCall(50, () => boss.clearTint());

        if (this.bossHP <= 0) {
            this.defeatBoss();
        }
    }

    hitBossWithPineapple(boss, pineapple) {
        if (pineapple.explosionTimer) pineapple.explosionTimer.remove();
        this.createExplosion(pineapple.x, pineapple.y, 'large');
        this.bossHP -= 80;
        pineapple.destroy();
        this.updateBossHealthBar();

        boss.setTint(0xff0000);
        this.time.delayedCall(100, () => boss.clearTint());

        if (this.bossHP <= 0) {
            this.defeatBoss();
        }
    }

    updateBossHealthBar() {
        const healthPercent = Math.max(0, this.bossHP / this.bossMaxHP);
        this.bossHealthBar.setScale(healthPercent, 1);

        if (healthPercent < 0.3) {
            this.bossHealthBar.setFillStyle(0xff0000);
        } else if (healthPercent < 0.6) {
            this.bossHealthBar.setFillStyle(0xff8800);
        }
    }

    defeatBoss() {
        this.bossActive = false;
        this.bossHealthContainer.setVisible(false);

        // Stop boss music and fade back to overworld
        if (this.bossMusic && this.bossMusic.isPlaying) {
            this.tweens.add({
                targets: this.bossMusic,
                volume: 0,
                duration: 1500,
                onComplete: () => {
                    this.bossMusic.stop();
                }
            });
        }

        // Resume overworld music
        this.time.delayedCall(1000, () => {
            this.overworldMusic = this.sound.add('overworld-theme', { loop: true, volume: 0 });
            this.overworldMusic.play();
            this.tweens.add({
                targets: this.overworldMusic,
                volume: 0.6,
                duration: 2000
            });
        });

        // Multiple explosions
        for (let i = 0; i < 8; i++) {
            this.time.delayedCall(i * 200, () => {
                const x = this.boss.x + Phaser.Math.Between(-80, 80);
                const y = this.boss.y + Phaser.Math.Between(-40, 40);
                this.createExplosion(x, y, 'large');
                this.cameras.main.shake(100, 0.02);
            });
        }

        // Play zeppelin down sound at 30% volume
        this.sound.play('zeppelin-down', { volume: 0.3 });

        this.score += 5000 * this.level;
        this.scoreText.setText('SCORE: ' + this.score);

        this.time.delayedCall(1600, () => {
            if (this.boss) this.boss.destroy();
            this.levelComplete();
        });
    }

    levelComplete() {
        // Stop all sounds before transitioning to next level
        this.sound.stopAll();

        if (this.level >= 3) {
            this.scene.start('VictoryScene', { score: this.score });
        } else {
            this.announceText.setText('LEVEL COMPLETE!');
            this.announceText.setAlpha(1);

            this.time.delayedCall(2500, () => {
                this.scene.start('GameScene', {
                    level: this.level + 1,
                    score: this.score
                });
            });
        }
    }

    // ============== COLLISIONS ==============

    hitEnemyWithBoomerang(boomerang, enemy) {
        const damage = boomerang.power;
        enemy.health -= damage;

        if (enemy.health <= 0) {
            this.destroyEnemy(enemy);
        } else {
            enemy.setTint(0xff0000);
            this.time.delayedCall(100, () => {
                if (enemy.active) enemy.clearTint();
            });
        }

        // Boomerang continues (doesn't get destroyed on hit)
    }

    hitEnemyWithCoconut(coconut, enemy) {
        this.createExplosion(coconut.x, coconut.y, 'small');
        enemy.health -= 2;
        coconut.destroy();

        if (enemy.health <= 0) {
            this.destroyEnemy(enemy);
        }
    }

    hitTurretWithCoconut(coconut, turret) {
        this.createExplosion(coconut.x, coconut.y, 'small');
        turret.health -= 2;
        coconut.destroy();

        if (turret.health <= 0) {
            this.createExplosion(turret.x, turret.y, 'large');
            // Play bomb explode sound at 30% volume
            this.sound.play('bomb-explode', { volume: 0.3 });
            this.score += 300;
            this.scoreText.setText('SCORE: ' + this.score);
            turret.destroy();
        }
    }

    hitEnemyWithPineapple(pineapple, enemy) {
        if (pineapple.explosionTimer) pineapple.explosionTimer.remove();
        this.createExplosion(pineapple.x, pineapple.y, 'large');
        this.damageEnemiesInRadius(pineapple.x, pineapple.y, 80);
        pineapple.destroy();
    }

    destroyEnemy(enemy) {
        this.createExplosion(enemy.x, enemy.y, 'small');
        this.score += enemy.points;
        this.scoreText.setText('SCORE: ' + this.score);

        // Play appropriate sound based on enemy type at 30% volume
        if (enemy.isBird) {
            this.sound.play('bird-cry', { volume: 0.3 });
        } else {
            this.sound.play('plane-explode', { volume: 0.3 });
        }

        enemy.destroy();
    }

    playerHitByEnemy(player, enemy) {
        if (this.isInvincible) return;

        this.takeDamage(30);

        if (enemy !== this.boss) {
            this.createExplosion(enemy.x, enemy.y, 'small');
            enemy.destroy();
        }
    }

    playerHitByBullet(player, bullet) {
        if (this.isInvincible) return;

        this.takeDamage(15);
        bullet.destroy();
    }

    takeDamage(amount) {
        this.health -= amount;
        this.updateHealthBar();

        this.player.setTint(0xff0000);
        this.time.delayedCall(100, () => {
            if (this.player.active) this.player.clearTint();
        });

        this.cameras.main.shake(100, 0.01);

        if (this.health <= 0) {
            this.loseLife();
        }
    }

    updateHealthBar() {
        const pct = Math.max(0, this.health / this.maxHealth);
        this.healthBar.setScale(pct, 1);
        this.healthBar.setFillStyle(pct > 0.6 ? 0x00ff00 : pct > 0.3 ? 0xffff00 : 0xff0000);
    }

    loseLife() {
        this.lives--;
        this.livesText.setText('❤️ x ' + this.lives);

        if (this.lives <= 0) {
            this.startCrashSequence(true); // true = game over after crash
        } else {
            this.startCrashSequence(false); // false = respawn after crash
        }
    }

    startCrashSequence(isGameOver) {
        // Play death explosion sound at 30% volume
        this.sound.play('death-explosion', { volume: 0.3 });

        // Disable controls during crash
        this.isCrashing = true;
        this.isInvincible = true;

        // Start smoke trail
        this.smokeEmitter = this.time.addEvent({
            delay: 50,
            callback: () => {
                if (!this.player.active || !this.isCrashing) return;
                const smoke = this.add.circle(
                    this.player.x - 30 + Phaser.Math.Between(-10, 10),
                    this.player.y + Phaser.Math.Between(-5, 5),
                    Phaser.Math.Between(5, 12),
                    0x444444,
                    0.7
                );
                smoke.setDepth(8);
                this.tweens.add({
                    targets: smoke,
                    alpha: 0,
                    scale: 2,
                    x: smoke.x - 30,
                    duration: 600,
                    onComplete: () => smoke.destroy()
                });
            },
            loop: true
        });

        // Play damaged animation
        this.player.play('biplane-damaged');
        this.player.setTint(0xff6600);

        // Store original position for arc calculation
        const startX = this.player.x;
        const startY = this.player.y;
        const groundY = 400; // Crash at ground level

        // Crash arc animation - lose control and spiral down
        this.tweens.add({
            targets: this.player,
            x: startX - 150, // Drift left while falling
            y: groundY,
            angle: 45, // Rotate as it falls
            duration: 1500,
            ease: 'Quad.easeIn',
            onUpdate: (tween) => {
                // Add wobble during fall
                this.player.x += Math.sin(tween.progress * 20) * 2;
            },
            onComplete: () => {
                // Stop smoke
                if (this.smokeEmitter) this.smokeEmitter.remove();

                // Big explosion at crash site with smoke
                this.createExplosion(this.player.x, this.player.y, 'large');
                this.createExplosion(this.player.x - 20, this.player.y, 'large');
                this.createExplosion(this.player.x + 15, this.player.y - 10, 'large');

                // Add smoke cloud effect
                for (let i = 0; i < 8; i++) {
                    const smoke = this.add.circle(
                        this.player.x + Phaser.Math.Between(-40, 40),
                        this.player.y + Phaser.Math.Between(-20, 10),
                        Phaser.Math.Between(15, 30),
                        0x333333,
                        0.8
                    );
                    smoke.setDepth(12);
                    this.tweens.add({
                        targets: smoke,
                        alpha: 0,
                        scale: 2.5,
                        y: smoke.y - 50,
                        duration: 1500,
                        delay: i * 50,
                        onComplete: () => smoke.destroy()
                    });
                }

                this.cameras.main.shake(300, 0.02);

                // Hide player during explosion
                this.player.setVisible(false);

                // Wait then respawn or game over
                this.time.delayedCall(800, () => {
                    if (isGameOver) {
                        this.gameOver();
                    } else {
                        this.respawn();
                    }
                });
            }
        });
    }

    respawn() {
        // Reset crash state
        this.isCrashing = false;

        // Reset health
        this.health = this.maxHealth;
        this.updateHealthBar();

        // Reset player position and appearance
        this.player.setPosition(100, 225);
        this.player.setAngle(0);
        this.player.clearTint();
        this.player.setVisible(true);
        this.player.play('biplane-idle');

        // Invincibility frames
        this.isInvincible = true;
        this.tweens.add({
            targets: this.player,
            alpha: { from: 0.3, to: 0.8 },
            duration: 100,
            repeat: 15,
            yoyo: true,
            onComplete: () => {
                this.isInvincible = false;
                this.player.setAlpha(1);
            }
        });
    }

    gameOver() {
        this.isDead = true;
        this.createExplosion(this.player.x, this.player.y, 'large');
        this.player.setVisible(false);

        if (this.enemySpawnTimer) this.enemySpawnTimer.remove();

        const highScore = parseInt(localStorage.getItem('redBaronHighScore')) || 0;
        if (this.score > highScore) {
            localStorage.setItem('redBaronHighScore', this.score);
        }

        this.time.delayedCall(2000, () => {
            this.scene.start('GameOverScene', {
                score: this.score,
                level: this.level,
                wave: this.wave
            });
        });
    }

    // ============== EFFECTS ==============

    createExplosion(x, y, size) {
        const explosion = this.add.image(x, y, 'explosion');
        explosion.setScale(size === 'large' ? 0.15 : 0.08);
        explosion.setDepth(50);

        this.tweens.add({
            targets: explosion,
            scale: explosion.scaleX * 1.5,
            alpha: 0,
            duration: 400,
            onComplete: () => explosion.destroy()
        });

        this.cameras.main.shake(size === 'large' ? 150 : 80, 0.01);
    }

    cleanupOffscreen() {
        this.boomerangs.getChildren().forEach(b => {
            if (b.x > 900 || b.x < -100) b.destroy();
        });
        this.coconuts.getChildren().forEach(c => {
            if (c.y > 500) c.destroy();
        });
        this.enemyBullets.getChildren().forEach(b => {
            if (b.x < -50 || b.x > 850 || b.y < -50 || b.y > 500) b.destroy();
        });
    }
}
