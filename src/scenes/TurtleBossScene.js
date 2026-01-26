export default class TurtleBossScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TurtleBossScene' });
    }

    init(data) {
        // Store game state passed from main game
        this.fromMainGame = data && data.fromMainGame || false;
        this.level = data && data.level || 2;
        this.score = data && data.score || 0;
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Static background for turtle boss battle (no parallax) - moved down 200px
        this.bg = this.add.image(0, 200, 'scene3-fg')
            .setOrigin(0, 0)
            .setDepth(0)
            .setDisplaySize(width, height - 190);

        // Create projectile groups FIRST (before anything that might reference them)
        this.boomerangs = this.physics.add.group();
        this.coconuts = this.physics.add.group();
        this.pineapples = this.physics.add.group();
        this.magneticMissiles = this.physics.add.group();
        this.enemyBullets = this.physics.add.group();

        // Create player
        this.createPlayer();
        this.setupInput();

        // Player state
        this.boomerangOut = false;
        this.lastBoomerangTime = 0;
        this.boomerangCooldown = 300;
        this.lastCoconutTime = 0;
        this.coconutCooldown = 500;  // 500ms cooldown between coconut drops
        this.mouseX = width / 2;
        this.mouseY = height / 2;

        // Spawn turtle boss
        this.spawnTurtleBoss();

        // Setup collisions AFTER boss and groups exist
        this.setupCollisions();

        // Create UI
        this.createUI();

        // Instructions
        this.add.text(width / 2, 20, 'TURTLE MECH BOSS BATTLE - Press ESC for Menu', {
            fontFamily: 'monospace',
            fontSize: '14px',
            fill: '#ffffff',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(100);

        // ESC to return to menu
        this.input.keyboard.on('keydown-ESC', () => {
            this.sound.stopAll();
            this.scene.start('MenuScene');
        });

        // Explicitly stop any zeppelin sounds that may have carried over
        this.sound.stopByKey('zeppelin-approach');
        this.sound.stopByKey('zeppelin-down');

        // Play turtle boss approach sound (no boss-theme music for this battle)
        if (this.cache.audio.exists('turtle-approach')) {
            this.sound.play('turtle-approach', { volume: 0.5 });
        }

        // DEBUG: X key to instantly kill boss for testing transitions
        this.input.keyboard.on('keydown-X', () => {
            if (this.boss && this.boss.active && this.boss.state !== 'dead') {
                console.log('DEBUG: Killing Turtle Boss instantly');
                this.boss.health = 0;
                this.defeatTurtleBoss();
            }
        });
    }

    createPlayer() {
        this.player = this.physics.add.sprite(150, 225, 'biplane');
        this.player.setScale(0.35);
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(10);
        this.player.body.setSize(140, 90);
        this.player.play('biplane-idle');

        // Player health
        this.playerHealth = 100;
        this.playerMaxHealth = 100;
        this.isInvincible = false;
        this.playerDead = false;
    }

    setupInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wKey = this.input.keyboard.addKey('W');
        this.sKey = this.input.keyboard.addKey('S');
        this.aKey = this.input.keyboard.addKey('A');
        this.dKey = this.input.keyboard.addKey('D');
        this.fKey = this.input.keyboard.addKey('F');
        this.gKey = this.input.keyboard.addKey('G');

        this.input.on('pointermove', (pointer) => {
            this.mouseX = pointer.x;
            this.mouseY = pointer.y;
        });

        this.input.on('pointerdown', (pointer) => {
            if (pointer.leftButtonDown()) {
                this.throwBoomerang();
            }
        });
    }

    createUI() {
        // Boss health bar container
        this.bossHealthContainer = this.add.container(400, 40);

        const healthBg = this.add.rectangle(0, 0, 300, 20, 0x333333);
        this.bossHealthBar = this.add.rectangle(-145, 0, 290, 16, 0xff0000).setOrigin(0, 0.5);
        const healthBorder = this.add.rectangle(0, 0, 300, 20).setStrokeStyle(2, 0xffffff);

        this.bossHealthContainer.add([healthBg, this.bossHealthBar, healthBorder]);
        this.bossHealthContainer.setDepth(100);

        // Boss name
        this.add.text(400, 60, 'TURTLE MECH', {
            fontFamily: 'monospace',
            fontSize: '14px',
            fill: '#ff6600',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(100);

        // Player health bar
        this.playerHealthContainer = this.add.container(120, 430);
        const playerHealthBg = this.add.rectangle(0, 0, 200, 16, 0x333333);
        this.playerHealthBar = this.add.rectangle(-95, 0, 190, 12, 0x00ff00).setOrigin(0, 0.5);
        const playerHealthBorder = this.add.rectangle(0, 0, 200, 16).setStrokeStyle(2, 0xffffff);
        this.playerHealthContainer.add([playerHealthBg, this.playerHealthBar, playerHealthBorder]);
        this.playerHealthContainer.setDepth(100);

        this.add.text(120, 410, 'PLAYER', {
            fontFamily: 'monospace',
            fontSize: '12px',
            fill: '#00ff00',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(100);
    }

    // ============== TURTLE BOSS ==============

    spawnTurtleBoss() {
        // Spawn turtle boss in lower-middle of screen (visible above clouds)
        this.boss = this.physics.add.sprite(400, 320, 'boss-turtle');
        this.boss.setScale(1.0);
        this.boss.setDepth(15);
        this.boss.play('turtle-walk');

        // Turtle stats - twice Zeppelin health
        this.boss.maxHealth = 200;
        this.boss.health = this.boss.maxHealth;

        // Movement
        this.boss.walkSpeed = 40;
        this.boss.walkDirection = 1;
        this.boss.setVelocityX(this.boss.walkSpeed);

        // State machine
        this.boss.state = 'walking';
        this.boss.fireCooldown = 4500;  // 25% faster firing rate (was 6000)
        this.boss.lastFireTime = 0;

        // Stalled phase turrets
        this.boss.stalledTurrets = [];

        // Body for collisions - IMMOVABLE so nothing pushes it
        this.boss.body.setSize(180, 150);
        this.boss.body.setOffset(10, 50);
        this.boss.body.setImmovable(true);

        // Store spawn Y to lock position
        this.boss.lockedY = 320;
    }

    updateTurtleBoss(time, delta) {
        if (!this.boss || !this.boss.active) return;

        const healthPercent = this.boss.health / this.boss.maxHealth;

        // Debug logging
        if (healthPercent <= 0.15 && healthPercent > 0) {
            console.log(`Boss health: ${this.boss.health}/${this.boss.maxHealth} (${(healthPercent * 100).toFixed(1)}%), state: ${this.boss.state}`);
        }

        // Handle damage phases - check stalled FIRST since it's the higher threshold
        if (healthPercent <= 0) {
            this.defeatTurtleBoss();
            return;
        } else if (healthPercent <= 0.10 && this.boss.state === 'walking') {
            // Enter stalled phase at 10% health
            console.log('Entering stalled phase!');
            this.enterStalledPhase();
        } else if (healthPercent <= 0.05 && this.boss.state === 'stalled') {
            // Enter critical phase at 5% health (only after stalled)
            console.log('Entering critical phase!');
            this.enterCriticalPhase();
        }

        // State-based behavior
        switch (this.boss.state) {
            case 'walking':
                this.updateTurtleWalking(time);
                break;
            case 'stalled':
            case 'stalled-critical':
                // Turrets handle combat, turtle just smokes
                break;
        }

        // Update magnetic missiles
        this.updateMagneticMissiles();

        // Update health bar
        this.updateBossHealthBar();
    }

    updateTurtleWalking(time) {
        // Boundary check - turn around at edges
        if (this.boss.x >= 700) {
            this.boss.walkDirection = -1;
            this.boss.setFlipX(true);
        } else if (this.boss.x <= 100) {
            this.boss.walkDirection = 1;
            this.boss.setFlipX(false);
        }

        this.boss.setVelocityX(this.boss.walkSpeed * this.boss.walkDirection);

        // Calculate fire cooldown - tiered increase based on health
        const healthPercent = this.boss.health / this.boss.maxHealth;
        let currentCooldown = this.boss.fireCooldown;
        if (healthPercent <= 0.3) {
            currentCooldown = this.boss.fireCooldown * 0.25;  // 100% faster (quarter cooldown) at 30% or less
        } else if (healthPercent <= 0.5) {
            currentCooldown = this.boss.fireCooldown * 0.5;   // 50% faster (half cooldown) at 50% or less
        }

        // Debug log every 2 seconds
        if (!this.lastDebugTime || time - this.lastDebugTime > 2000) {
            console.log('updateTurtleWalking - time:', time, 'lastFireTime:', this.boss.lastFireTime, 'cooldown:', currentCooldown, 'state:', this.boss.state);
            this.lastDebugTime = time;
        }

        // Check if time to fire
        if (time > this.boss.lastFireTime + currentCooldown) {
            console.log('FIRING! time:', time, 'threshold:', this.boss.lastFireTime + currentCooldown);
            this.startTurtleFireSequence(time);
        }
    }

    startTurtleFireSequence(time) {
        this.boss.state = 'squatting';
        this.boss.setVelocityX(0);
        this.boss.play('turtle-squat');

        // After squat, fire
        this.time.delayedCall(500, () => {
            if (this.boss && this.boss.active && this.boss.state === 'squatting') {
                this.boss.state = 'firing';
                this.boss.play('turtle-fire');
                this.turtleFireMissile();

                // After firing, resume walking
                this.time.delayedCall(500, () => {
                    if (this.boss && this.boss.active && this.boss.state === 'firing') {
                        this.boss.state = 'walking';
                        this.boss.play('turtle-walk');
                        this.boss.lastFireTime = time;
                    }
                });
            }
        });
    }

    turtleFireMissile() {
        console.log('turtleFireMissile called!');

        // Play missile launch sound
        if (this.cache.audio.exists('turtle-missile-launch')) {
            this.sound.play('turtle-missile-launch', { volume: 0.5 });
        }

        // Fire a single missile AIMED at the player
        const missile = this.magneticMissiles.create(this.boss.x, this.boss.y - 50, 'boss-missile', 1);
        missile.setScale(0.8);
        missile.setDepth(20);

        // Calculate angle to player
        const angle = Phaser.Math.Angle.Between(
            missile.x, missile.y,
            this.player.x, this.player.y
        );

        // Fire at speed 200
        const speed = 200;
        missile.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
        );
        // Rotate 90 degrees clockwise from velocity direction (add PI instead of PI/2)
        missile.setRotation(angle + Math.PI);
        missile.body.setSize(30, 40);

        // Magnetic properties - weak field for easier orbiting
        missile.isMagnetic = true;
        missile.magneticStrength = 0.05;

        // IMPORTANT: Prevent self-damage on spawn
        // Missile can't hit boss until it's had time to travel away
        missile.canHitBoss = false;
        missile.spawnX = missile.x;
        missile.spawnY = missile.y;
        missile.spawnTime = this.time.now;
    }

    updateMagneticMissiles() {
        this.magneticMissiles.getChildren().forEach(missile => {
            if (!missile.active) return;

            const distToPlayer = Phaser.Math.Distance.Between(
                missile.x, missile.y,
                this.player.x, this.player.y
            );

            // Magnetic pull range - LARGER field (was 120)
            const magnetRange = 180;

            if (distToPlayer < magnetRange) {
                // Mark that missile has been near player (for slingshot detection)
                missile.wasNearPlayer = true;

                // DECELERATION: Reduced by 50% (was 0.98, now 0.99 = less slowdown)
                const friction = 0.99;
                missile.body.velocity.x *= friction;
                missile.body.velocity.y *= friction;

                // Calculate gravitational pull toward player (very weak)
                const angle = Phaser.Math.Angle.Between(
                    missile.x, missile.y,
                    this.player.x, this.player.y
                );

                // Pull strength - 50% stronger (was 0.75, now 1.125)
                const pullStrength = missile.magneticStrength * (magnetRange - distToPlayer) * 1.125;

                let vx = missile.body.velocity.x;
                let vy = missile.body.velocity.y;

                vx += Math.cos(angle) * pullStrength;
                vy += Math.sin(angle) * pullStrength;

                // Cap maximum speed
                const maxSpeed = 300;
                const currentSpeed = Math.sqrt(vx * vx + vy * vy);
                if (currentSpeed > maxSpeed) {
                    vx = (vx / currentSpeed) * maxSpeed;
                    vy = (vy / currentSpeed) * maxSpeed;
                }

                missile.setVelocity(vx, vy);
                missile.setRotation(Math.atan2(vy, vx) + Math.PI);
            }

            // Enable canHitBoss - after being near player for 600ms AND far from boss
            if (missile.wasNearPlayer && !missile.canHitBoss) {
                const distToBoss = Phaser.Math.Distance.Between(
                    missile.x, missile.y,
                    this.boss.x, this.boss.y
                );
                // Must be 600ms old AND at least 150px from boss to prevent self-damage
                if (this.time.now - missile.spawnTime > 600 && distToBoss > 150) {
                    missile.canHitBoss = true;
                }
            }

            // Destroy if off screen
            if (missile.y > 500 || missile.y < -50 || missile.x < -50 || missile.x > 850) {
                missile.destroy();
            }
        });
    }

    enterStalledPhase() {
        this.boss.state = 'stalled';
        this.boss.setVelocityX(0);
        this.boss.play('turtle-damaged1');

        // Spawn turrets on either side
        this.spawnStalledTurrets();

        // Start smoke effect
        this.boss.smokeTimer = this.time.addEvent({
            delay: 200,
            callback: () => this.createSmoke(this.boss.x, this.boss.y - 60, 'light'),
            loop: true
        });
    }

    enterCriticalPhase() {
        this.boss.state = 'stalled-critical';
        this.boss.play('turtle-damaged2');

        // Heavier smoke
        if (this.boss.smokeTimer) this.boss.smokeTimer.remove();
        this.boss.smokeTimer = this.time.addEvent({
            delay: 100,
            callback: () => this.createSmoke(this.boss.x, this.boss.y - 60, 'heavy'),
            loop: true
        });
    }

    spawnStalledTurrets() {
        // Left turret
        const leftTurret = this.physics.add.sprite(this.boss.x - 80, 400, 'turret');
        leftTurret.setScale(0.6);
        leftTurret.setDepth(7);
        leftTurret.health = 2;
        leftTurret.lastShot = 0;
        leftTurret.shootDelay = 2000;
        this.boss.stalledTurrets.push(leftTurret);

        // Right turret
        const rightTurret = this.physics.add.sprite(this.boss.x + 80, 400, 'turret');
        rightTurret.setScale(0.6);
        rightTurret.setDepth(7);
        rightTurret.health = 2;
        rightTurret.lastShot = 0;
        rightTurret.shootDelay = 2000;
        this.boss.stalledTurrets.push(rightTurret);

        // Setup turret collision with boomerangs
        this.boss.stalledTurrets.forEach(turret => {
            this.physics.add.overlap(this.boomerangs, turret, (boomerang, t) => {
                t.health--;
                if (t.health <= 0) {
                    this.createExplosion(t.x, t.y, 'small');
                    t.destroy();
                }
            });
        });

        // Turret shooting
        this.turretUpdateEvent = this.time.addEvent({
            delay: 100,
            callback: () => this.updateStalledTurrets(),
            loop: true
        });
    }

    updateStalledTurrets() {
        const time = this.time.now;
        this.boss.stalledTurrets.forEach(turret => {
            if (!turret.active) return;

            if (time > turret.lastShot + turret.shootDelay) {
                this.turretShoot(turret);
                turret.lastShot = time;
            }
        });
    }

    turretShoot(turret) {
        if (!this.player.active) return;

        const missile = this.enemyBullets.create(turret.x, turret.y - 30, 'turret-missile');
        missile.setScale(0.35);
        missile.setDepth(10);

        const angle = Phaser.Math.Angle.Between(
            turret.x, turret.y,
            this.player.x, this.player.y
        );
        missile.setRotation(angle + Math.PI / 2);
        missile.setVelocity(
            Math.cos(angle) * 250,
            Math.sin(angle) * 250
        );
        missile.body.setSize(40, 60);
    }

    createSmoke(x, y, intensity) {
        const size = intensity === 'heavy' ? Phaser.Math.Between(15, 25) : Phaser.Math.Between(8, 15);
        const smoke = this.add.circle(
            x + Phaser.Math.Between(-20, 20),
            y,
            size,
            0x444444,
            0.7
        );
        smoke.setDepth(12);

        this.tweens.add({
            targets: smoke,
            alpha: 0,
            y: smoke.y - 40,
            scale: 1.5,
            duration: 800,
            onComplete: () => smoke.destroy()
        });
    }

    defeatTurtleBoss() {
        if (this.boss.state === 'dead') return;
        this.boss.state = 'dead';

        // Stop timers
        if (this.boss.smokeTimer) this.boss.smokeTimer.remove();
        if (this.turretUpdateEvent) this.turretUpdateEvent.remove();

        // Destroy turrets
        this.boss.stalledTurrets.forEach(t => t.destroy());

        // Play death animation - frame 11 (index 10)
        this.boss.setVelocity(0, 0);
        this.boss.play('turtle-death');



        // MASSIVE EXPLOSION SEQUENCE - more explosions, bigger shakes
        for (let i = 0; i < 15; i++) {
            this.time.delayedCall(i * 120, () => {
                if (!this.boss) return;
                const ex = this.boss.x + Phaser.Math.Between(-80, 80);
                const ey = this.boss.y + Phaser.Math.Between(-60, 60);
                this.createExplosion(ex, ey, 'large');
                this.cameras.main.shake(150, 0.03);

                // Play random explosion sound
                if (Math.random() < 0.5) {
                    this.sound.play('bomb-explode', { volume: 0.3 });
                } else {
                    this.sound.play('plane-explode', { volume: 0.3 });
                }
            });
        }

        // Final massive explosion and destroy boss - 50% faster (was 1800ms)
        this.time.delayedCall(900, () => {
            if (!this.boss) return;
            // Create multiple large explosions at boss center
            for (let i = 0; i < 5; i++) {
                this.createExplosion(this.boss.x + Phaser.Math.Between(-30, 30), this.boss.y + Phaser.Math.Between(-30, 30), 'large');
            }
            this.cameras.main.shake(300, 0.05);

            // Play both explosion sounds for final blast
            this.sound.play('bomb-explode', { volume: 0.5 });
            this.sound.play('plane-explode', { volume: 0.5 });

            // Destroy the boss sprite
            this.boss.destroy();
            this.boss = null;
        });

        // Victory after explosions
        this.time.delayedCall(1800, () => {
            // Stop boss music
            this.sound.stopAll();

            // Play victory sound
            if (this.sound.get('victory')) {
                this.sound.play('victory', { volume: 0.5 });
            }

            this.add.text(400, 160, 'TURTLE MECH DEFEATED!', {
                fontFamily: 'monospace',
                fontSize: '32px',
                fill: '#00ff00',
                stroke: '#000',
                strokeThickness: 4
            }).setOrigin(0.5).setDepth(100);

            // If we came from the main game, continue to next level
            if (this.fromMainGame) {
                // Add boss defeat bonus to score
                const bossBonus = 5000 * this.level;
                this.score += bossBonus;

                this.add.text(400, 200, 'BOSS BONUS: +' + bossBonus, {
                    fontFamily: 'monospace',
                    fontSize: '18px',
                    fill: '#ffff00',
                    stroke: '#000',
                    strokeThickness: 3
                }).setOrigin(0.5).setDepth(100);

                // After delay, continue to next level or victory
                this.time.delayedCall(2500, () => {
                    if (this.level >= 3) {
                        // Game complete!
                        this.scene.start('VictoryScene', { score: this.score });
                    } else {
                        // Continue to next level
                        this.cameras.main.fadeOut(1000, 0, 0, 0);
                        this.cameras.main.once('camerafadeoutcomplete', () => {
                            this.scene.start('GameScene', {
                                level: this.level + 1,
                                score: this.score
                            });
                        });
                    }
                });
            } else {
                // Standalone boss test mode - show fight again / menu buttons
                // Fight again button
                const restartBtn = this.add.text(400, 220, '[ FIGHT AGAIN ]', {
                    fontFamily: 'monospace',
                    fontSize: '18px',
                    fill: '#ffff00',
                    stroke: '#000',
                    strokeThickness: 3
                }).setOrigin(0.5).setDepth(100).setInteractive({ useHandCursor: true });
                restartBtn.on('pointerover', () => restartBtn.setScale(1.1));
                restartBtn.on('pointerout', () => restartBtn.setScale(1));
                restartBtn.on('pointerdown', () => {
                    this.sound.stopAll();
                    this.scene.restart();
                });

                // Menu button
                const menuBtn = this.add.text(400, 260, '[ MAIN MENU ]', {
                    fontFamily: 'monospace',
                    fontSize: '18px',
                    fill: '#aaddff',
                    stroke: '#000',
                    strokeThickness: 3
                }).setOrigin(0.5).setDepth(100).setInteractive({ useHandCursor: true });
                menuBtn.on('pointerover', () => menuBtn.setScale(1.1));
                menuBtn.on('pointerout', () => menuBtn.setScale(1));
                menuBtn.on('pointerdown', () => {
                    this.sound.stopAll();
                    this.scene.start('MenuScene');
                });
            }
        });
    }

    // ============== PLAYER ATTACKS ==============

    throwBoomerang() {
        const time = this.time.now;
        if (this.boomerangOut || time < this.lastBoomerangTime + this.boomerangCooldown) return;

        this.boomerangOut = true;
        this.lastBoomerangTime = time;

        const boomerang = this.boomerangs.create(this.player.x + 30, this.player.y, 'boomerang');
        boomerang.setScale(1.0);
        boomerang.setDepth(10);
        boomerang.body.setSize(60, 60);

        boomerang.isReturning = false;
        boomerang.homingStrength = 0;

        // Fire straight to the right (not at mouse cursor)
        boomerang.setVelocity(500, 0);

        // Play sound
        if (this.sound.get('banana-whip')) {
            this.sound.play('banana-whip', { volume: 0.3 });
        }

        this.time.delayedCall(400, () => {
            if (boomerang.active) {
                boomerang.isReturning = true;
                boomerang.homingStrength = 15;
            }
        });
    }

    dropCoconut() {
        const coconut = this.coconuts.create(this.player.x, this.player.y + 20, 'coconut');
        coconut.setScale(1.0);
        coconut.setDepth(5);
        coconut.setVelocityY(300);
        coconut.body.setSize(30, 30);

        // Play sound
        if (this.sound.get('coconut-bomb')) {
            this.sound.play('coconut-bomb', { volume: 0.17 });
        }
    }

    throwPineapple() {
        const pineapple = this.pineapples.create(this.player.x + 30, this.player.y, 'pineapple');
        pineapple.setScale(0.5);
        pineapple.setDepth(5);
        pineapple.setVelocityX(400);
        pineapple.body.setSize(40, 40);

        // Play sound
        if (this.sound.get('pineapple-shoot')) {
            this.sound.play('pineapple-shoot', { volume: 0.375 });
        }
    }

    // ============== COLLISIONS ==============

    setupCollisions() {
        // NOTE: Boomerang and coconut collisions are handled manually in update()
        // to prevent physics displacement issues

        // Pineapple hits turtle
        this.physics.add.overlap(this.pineapples, this.boss, (pineapple, boss) => {
            this.hitTurtleWithPineapple(pineapple, boss);
        });

        // Magnetic missile hits turtle (reflected back)
        this.physics.add.overlap(this.magneticMissiles, this.boss, (missile, boss) => {
            this.missileHitsTurtle(missile, boss);
        });

        // Enemy bullets hit player
        this.physics.add.overlap(this.player, this.enemyBullets, (player, bullet) => {
            this.playerHitByBullet(player, bullet);
        });

        // Magnetic missiles hit player
        this.physics.add.overlap(this.player, this.magneticMissiles, (player, missile) => {
            this.playerHitByMissile(player, missile);
        });
    }

    playerHitByBullet(player, bullet) {
        if (this.isInvincible || this.playerDead) return;

        this.playerHealth -= 15;
        bullet.destroy();

        this.cameras.main.shake(100, 0.01);
        player.setTint(0xff0000);
        this.time.delayedCall(100, () => player.clearTint());

        this.updatePlayerHealthBar();

        if (this.playerHealth <= 0) {
            this.playerDeath();
        } else {
            this.isInvincible = true;
            this.time.delayedCall(500, () => this.isInvincible = false);
        }
    }

    playerHitByMissile(player, missile) {
        if (this.isInvincible || this.playerDead) return;

        this.playerHealth -= 25;  // Missiles do more damage
        missile.destroy();

        this.cameras.main.shake(150, 0.015);
        player.setTint(0xff0000);
        this.time.delayedCall(100, () => player.clearTint());

        // Play explosion effect
        this.createExplosion(missile.x, missile.y, 'small');

        this.updatePlayerHealthBar();

        if (this.playerHealth <= 0) {
            this.playerDeath();
        } else {
            this.isInvincible = true;
            this.time.delayedCall(800, () => this.isInvincible = false);
        }
    }

    updatePlayerHealthBar() {
        const healthPercent = Math.max(0, this.playerHealth / this.playerMaxHealth);
        this.playerHealthBar.setScale(healthPercent, 1);

        if (healthPercent < 0.3) {
            this.playerHealthBar.setFillStyle(0xff0000);
        } else if (healthPercent < 0.6) {
            this.playerHealthBar.setFillStyle(0xff8800);
        } else {
            this.playerHealthBar.setFillStyle(0x00ff00);
        }
    }

    playerDeath() {
        this.playerDead = true;
        this.player.setVelocity(0, 0);
        this.player.play('biplane-damaged', true);

        // Create explosion
        this.createExplosion(this.player.x, this.player.y, 'large');
        this.cameras.main.shake(300, 0.03);

        // Play explosion sound
        if (this.cache.audio.exists('plane-explode')) {
            this.sound.play('plane-explode', { volume: 0.5 });
        }

        // Hide player
        this.time.delayedCall(200, () => {
            if (this.player) this.player.setVisible(false);
        });

        // Show game over
        this.time.delayedCall(1500, () => {
            this.sound.stopAll();

            this.add.text(400, 160, 'DEFEATED!', {
                fontFamily: 'monospace',
                fontSize: '32px',
                fill: '#ff0000',
                stroke: '#000',
                strokeThickness: 4
            }).setOrigin(0.5).setDepth(100);

            // Retry button
            const retryBtn = this.add.text(400, 220, '[ TRY AGAIN ]', {
                fontFamily: 'monospace',
                fontSize: '18px',
                fill: '#ffff00',
                stroke: '#000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(100).setInteractive({ useHandCursor: true });
            retryBtn.on('pointerover', () => retryBtn.setScale(1.1));
            retryBtn.on('pointerout', () => retryBtn.setScale(1));
            retryBtn.on('pointerdown', () => {
                this.sound.stopAll();
                this.scene.restart();
            });

            // Menu button
            const menuBtn = this.add.text(400, 260, '[ MAIN MENU ]', {
                fontFamily: 'monospace',
                fontSize: '18px',
                fill: '#aaddff',
                stroke: '#000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(100).setInteractive({ useHandCursor: true });
            menuBtn.on('pointerover', () => menuBtn.setScale(1.1));
            menuBtn.on('pointerout', () => menuBtn.setScale(1));
            menuBtn.on('pointerdown', () => {
                this.sound.stopAll();
                this.scene.start('MenuScene');
            });
        });
    }

    hitTurtleWithBoomerang(boomerang, boss) {
        // Prevent multiple hits from same boomerang
        if (boomerang.hasHitBoss) return;
        boomerang.hasHitBoss = true;

        // Store boss position BEFORE anything else
        const bossX = boss.x;
        const bossY = boss.y;

        // Play banana metal sound
        if (this.cache.audio.exists('banana-metal')) {
            this.sound.play('banana-metal', { volume: 0.5 });
        }

        // Boomerangs harmlessly bounce off turtle's shell - NO DAMAGE!
        this.createBounceEffect(boomerang.x, boomerang.y);

        // Brief gray tint - check boss exists and is active
        if (boss && boss.active) {
            boss.setTint(0x888888);
            this.time.delayedCall(100, () => {
                if (boss && boss.active) boss.clearTint();
            });

            // FORCE boss back to original position
            boss.x = bossX;
            boss.y = bossY;
            boss.setVelocityY(0);
            if (boss.state === 'walking') {
                boss.setVelocityX(boss.walkSpeed * boss.walkDirection);
            } else {
                boss.setVelocityX(0);
            }
        }

        // Slight camera feedback
        this.cameras.main.shake(30, 0.005);

        // Just destroy the boomerang and let player throw again
        boomerang.destroy();
        this.boomerangOut = false;
    }

    hitTurtleWithCoconut(coconut, boss) {
        // Prevent multiple hits from same coconut
        if (coconut.hasHitBoss) return;
        coconut.hasHitBoss = true;

        // Store boss position BEFORE anything else
        const bossX = boss.x;
        const bossY = boss.y;

        // Reduced damage (25% of normal 5 damage)
        const damage = 5 * 0.25;
        boss.health -= damage;

        // Play random coconut metal sound
        const metalSound = Math.random() < 0.5 ? 'coconut-metal-1' : 'coconut-metal-2';
        if (this.cache.audio.exists(metalSound)) {
            this.sound.play(metalSound, { volume: 0.5 });
        }

        // Bounce the coconut away
        coconut.setVelocity(
            Phaser.Math.Between(-150, 150),
            -250
        );

        // FORCE boss back to original position and velocity
        boss.x = bossX;
        boss.y = bossY;
        boss.setVelocityY(0);
        if (boss.state === 'walking') {
            boss.setVelocityX(boss.walkSpeed * boss.walkDirection);
        } else {
            boss.setVelocityX(0);
        }

        // Spark effect only - no explosion
        this.createBounceEffect(coconut.x, coconut.y);
        this.cameras.main.shake(50, 0.005);

        this.updateBossHealthBar();
    }

    hitTurtleWithPineapple(pineapple, boss) {
        // Pineapple grenades deal full damage (10hp)
        boss.health -= 10;

        pineapple.destroy();
        this.createExplosion(pineapple.x, pineapple.y, 'large');
        this.cameras.main.shake(100, 0.01);

        // Play explosion sound
        if (this.sound.get('bomb-explode')) {
            this.sound.play('bomb-explode', { volume: 0.4 });
        }

        this.updateBossHealthBar();
    }

    missileHitsTurtle(missile, boss) {
        // Only reflected/redirected missiles can hit the boss
        if (!missile.canHitBoss) return;

        // Reflected missile does bonus damage!
        const bonusDamage = boss.maxHealth / 6;
        boss.health -= bonusDamage;

        missile.destroy();
        this.createExplosion(missile.x, missile.y, 'large');
        this.cameras.main.shake(150, 0.02);

        this.updateBossHealthBar();
    }

    // ============== EFFECTS ==============

    createBounceEffect(x, y) {
        for (let i = 0; i < 5; i++) {
            const spark = this.add.circle(x, y, 3, 0xffff00, 1);
            spark.setDepth(15);

            this.tweens.add({
                targets: spark,
                x: x + Phaser.Math.Between(-30, 30),
                y: y + Phaser.Math.Between(-30, 10),
                alpha: 0,
                duration: 300,
                onComplete: () => spark.destroy()
            });
        }
    }

    createExplosion(x, y, size) {
        const explosion = this.add.sprite(x, y, 'explosion');
        explosion.setScale(size === 'large' ? 1.5 : 0.8);
        explosion.setDepth(20);
        explosion.play('explode');
        explosion.on('animationcomplete', () => explosion.destroy());
    }

    updateBossHealthBar() {
        if (!this.boss) return;
        const healthPercent = Math.max(0, this.boss.health / this.boss.maxHealth);
        this.bossHealthBar.setScale(healthPercent, 1);

        // Color based on health
        if (healthPercent > 0.5) {
            this.bossHealthBar.setFillStyle(0x00ff00);
        } else if (healthPercent > 0.25) {
            this.bossHealthBar.setFillStyle(0xffff00);
        } else {
            this.bossHealthBar.setFillStyle(0xff0000);
        }
    }

    // ============== UPDATE LOOP ==============

    update(time, delta) {
        // Player vertical movement
        if (this.cursors.up.isDown || this.wKey.isDown) {
            this.player.setVelocityY(-250);
            this.player.play('biplane-up', true);
        } else if (this.cursors.down.isDown || this.sKey.isDown) {
            this.player.setVelocityY(250);
            this.player.play('biplane-down', true);
        } else {
            this.player.setVelocityY(0);
            this.player.play('biplane-idle', true);
        }

        // Player horizontal movement (A/D or Left/Right arrows)
        if (this.cursors.left.isDown || this.aKey.isDown) {
            this.player.setVelocityX(-200);
            this.player.setFlipX(true);  // Flip horizontally when moving left
        } else if (this.cursors.right.isDown || this.dKey.isDown) {
            this.player.setVelocityX(200);
            this.player.setFlipX(false);  // Normal orientation when moving right
        } else {
            this.player.setVelocityX(0);
        }

        // Drop coconut (SPACEBAR) - with cooldown
        if (Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
            if (time > this.lastCoconutTime + this.coconutCooldown) {
                this.dropCoconut();
                this.lastCoconutTime = time;
            }
        }

        // Throw pineapple grenade (G key)
        if (Phaser.Input.Keyboard.JustDown(this.gKey)) {
            this.throwPineapple();
        }

        // Update boomerangs
        this.boomerangs.getChildren().forEach(boomerang => {
            boomerang.angle += 15;

            if (boomerang.isReturning) {
                const angle = Phaser.Math.Angle.Between(
                    boomerang.x, boomerang.y,
                    this.player.x, this.player.y
                );
                boomerang.body.velocity.x += Math.cos(angle) * boomerang.homingStrength;
                boomerang.body.velocity.y += Math.sin(angle) * boomerang.homingStrength;
            }

            // Catch returning boomerang
            if (boomerang.isReturning) {
                const dist = Phaser.Math.Distance.Between(
                    boomerang.x, boomerang.y,
                    this.player.x, this.player.y
                );
                if (dist < 40) {
                    boomerang.destroy();
                    this.boomerangOut = false;
                }
            }

            // Destroy if off screen
            if (boomerang.x > 850 || boomerang.x < -50 || boomerang.y > 500 || boomerang.y < -50) {
                boomerang.destroy();
                this.boomerangOut = false;
            }
        });

        // Destroy off-screen coconuts
        this.coconuts.getChildren().forEach(coconut => {
            if (coconut.y > 500) {
                coconut.destroy();
            }
        });

        // Destroy off-screen pineapples
        this.pineapples.getChildren().forEach(pineapple => {
            if (pineapple.x > 850) {
                pineapple.destroy();
            }
        });

        // Update turtle boss
        this.updateTurtleBoss(time, delta);

        // LOCK BOSS Y POSITION - prevent any displacement
        if (this.boss && this.boss.active) {
            this.boss.y = this.boss.lockedY;
            this.boss.setVelocityY(0);
        }

        // Manual collision detection for boomerang, coconut, and missiles
        this.checkBoomerangBossCollision();
        this.checkCoconutBossCollision();
        this.checkMissileBossCollision();

        // Static background - no scrolling for turtle boss battle
    }

    checkBoomerangBossCollision() {
        if (!this.boss || !this.boss.active) return;

        this.boomerangs.getChildren().forEach(boomerang => {
            if (boomerang.hasHitBoss) return;

            const dist = Phaser.Math.Distance.Between(
                boomerang.x, boomerang.y,
                this.boss.x, this.boss.y
            );

            // Check if within boss hitbox radius
            if (dist < 100) {
                boomerang.hasHitBoss = true;

                // Play banana metal sound
                if (this.cache.audio.exists('banana-metal')) {
                    this.sound.play('banana-metal', { volume: 0.5 });
                }

                // Create bounce effect
                this.createBounceEffect(boomerang.x, boomerang.y);

                // Brief gray tint
                this.boss.setTint(0x888888);
                this.time.delayedCall(100, () => {
                    if (this.boss && this.boss.active) this.boss.clearTint();
                });

                // Camera shake
                this.cameras.main.shake(30, 0.005);

                // Destroy boomerang
                boomerang.destroy();
                this.boomerangOut = false;
            }
        });
    }

    checkCoconutBossCollision() {
        if (!this.boss || !this.boss.active) return;

        this.coconuts.getChildren().forEach(coconut => {
            if (coconut.hasHitBoss) return;

            const dist = Phaser.Math.Distance.Between(
                coconut.x, coconut.y,
                this.boss.x, this.boss.y
            );

            // Check if within boss hitbox radius
            if (dist < 100) {
                coconut.hasHitBoss = true;

                // Reduced damage (25%)
                this.boss.health -= 5 * 0.25;

                // Play random coconut metal sound
                const metalSound = Math.random() < 0.5 ? 'coconut-metal-1' : 'coconut-metal-2';
                if (this.cache.audio.exists(metalSound)) {
                    this.sound.play(metalSound, { volume: 0.5 });
                }

                // Bounce coconut away
                coconut.setVelocity(
                    Phaser.Math.Between(-150, 150),
                    -250
                );

                // Spark effect
                this.createBounceEffect(coconut.x, coconut.y);
                this.cameras.main.shake(50, 0.005);

                this.updateBossHealthBar();
            }
        });
    }

    checkMissileBossCollision() {
        if (!this.boss || !this.boss.active) return;

        this.magneticMissiles.getChildren().forEach(missile => {
            // Only allow collision if canHitBoss is true
            if (!missile.canHitBoss || missile.hasHitBoss) return;

            const dist = Phaser.Math.Distance.Between(
                missile.x, missile.y,
                this.boss.x, this.boss.y
            );

            // Check if within boss hitbox radius
            if (dist < 100) {
                missile.hasHitBoss = true;

                // Reflected missile does bonus damage! (1/12 of max health)
                const bonusDamage = this.boss.maxHealth / 12;
                this.boss.health -= bonusDamage;

                // Play explosion sound
                if (this.cache.audio.exists('plane-explode')) {
                    this.sound.play('plane-explode', { volume: 0.4 });
                }

                // Explosion effect
                this.createExplosion(missile.x, missile.y, 'large');
                this.cameras.main.shake(150, 0.02);

                // Destroy missile
                missile.destroy();

                this.updateBossHealthBar();
            }
        });
    }
}
