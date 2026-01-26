export default class BossTestScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BossTestScene' });
    }

    init(data) {
        this.testBoss = data.boss || 'turtle'; // 'turtle' or 'zeppelin'
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Use sky background
        this.bg = this.add.tileSprite(0, 0, width, height, 'scene1-bg')
            .setOrigin(0, 0)
            .setDepth(0);

        // Create player
        this.createPlayer();
        this.setupInput();

        // Create projectile groups
        this.boomerangs = this.physics.add.group();
        this.coconuts = this.physics.add.group();
        this.pineapples = this.physics.add.group();
        this.enemyBullets = this.physics.add.group();
        this.magneticMissiles = this.physics.add.group(); // Create early for collision setup

        // Player state
        this.boomerangOut = false;
        this.boomerangPower = 1;
        this.mouseX = width / 2;
        this.mouseY = height / 2;
        this.lastBoomerangTime = 0;
        this.boomerangCooldown = 300;

        // Spawn the test boss
        if (this.testBoss === 'turtle') {
            this.spawnTurtleBoss();
        } else {
            this.spawnZeppelinBoss();
        }

        // Setup collisions
        this.setupCollisions();

        // UI
        this.createUI();

        // Instructions
        this.add.text(width / 2, 20, 'BOSS TEST MODE - Press 1 for Turtle, 2 for Zeppelin, ESC for Menu', {
            fontFamily: 'monospace',
            fontSize: '12px',
            fill: '#ffffff',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(100);

        // Key bindings for switching bosses
        this.input.keyboard.on('keydown-ONE', () => this.scene.restart({ boss: 'turtle' }));
        this.input.keyboard.on('keydown-TWO', () => this.scene.restart({ boss: 'zeppelin' }));
        this.input.keyboard.on('keydown-ESC', () => this.scene.start('MenuScene'));
    }

    createPlayer() {
        this.player = this.physics.add.sprite(150, 225, 'biplane');
        this.player.setScale(0.35);
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(10);
        this.player.body.setSize(280, 180);
        this.player.play('biplane-idle');
    }

    setupInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wKey = this.input.keyboard.addKey('W');
        this.sKey = this.input.keyboard.addKey('S');
        this.fKey = this.input.keyboard.addKey('F');
        this.spaceKey = this.input.keyboard.addKey('SPACE');

        this.input.on('pointermove', (pointer) => {
            this.mouseX = pointer.x;
            this.mouseY = pointer.y;
        });

        this.input.on('pointerdown', (pointer) => {
            if (pointer.leftButtonDown()) {
                this.handleBoomerang(this.time.now);
            }
        });
    }

    createUI() {
        // Boss health bar
        this.bossHealthContainer = this.add.container(400, 40);

        const healthBg = this.add.rectangle(0, 0, 300, 20, 0x333333);
        this.bossHealthBar = this.add.rectangle(-145, 0, 290, 16, 0xff0000).setOrigin(0, 0.5);
        const healthBorder = this.add.rectangle(0, 0, 300, 20).setStrokeStyle(2, 0xffffff);

        this.bossHealthContainer.add([healthBg, this.bossHealthBar, healthBorder]);
        this.bossHealthContainer.setDepth(100);

        // Boss name
        this.bossNameText = this.add.text(400, 60, '', {
            fontFamily: 'monospace',
            fontSize: '14px',
            fill: '#ffffff',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(100);
    }

    // ============== TURTLE BOSS ==============

    spawnTurtleBoss() {
        this.bossType = 'turtle';
        this.bossNameText.setText('TURTLE MECH');

        // Spawn at bottom of screen
        this.boss = this.physics.add.sprite(400, 380, 'boss-turtle');
        this.boss.setScale(0.8);
        this.boss.setDepth(8);
        this.boss.play('turtle-walk');

        // Turtle stats - 2x Zeppelin health
        this.boss.maxHealth = 200;  // Zeppelin has 100
        this.boss.health = this.boss.maxHealth;

        // Movement
        this.boss.walkSpeed = 40;  // Slow lumber
        this.boss.walkDirection = 1;  // 1 = right, -1 = left
        this.boss.setVelocityX(this.boss.walkSpeed);

        // State machine
        this.boss.state = 'walking';  // walking, squatting, firing, stalled, dead
        this.boss.fireTimer = 0;
        this.boss.fireCooldown = 3000;  // Fire every 3 seconds
        this.boss.lastFireTime = 0;

        // Stalled phase turrets
        this.boss.stalledTurrets = [];

        // Body for collisions
        this.boss.body.setSize(180, 150);
        this.boss.body.setOffset(10, 50);

        // Magnetic missiles group already created in create()
    }

    updateTurtleBoss(time, delta) {
        if (!this.boss || !this.boss.active) return;

        const healthPercent = this.boss.health / this.boss.maxHealth;

        // Handle damage phases
        if (healthPercent <= 0) {
            this.defeatTurtleBoss();
            return;
        } else if (healthPercent <= 0.10 && this.boss.state !== 'stalled-critical') {
            this.enterCriticalPhase();
        } else if (healthPercent <= 0.25 && this.boss.state !== 'stalled' && this.boss.state !== 'stalled-critical') {
            this.enterStalledPhase();
        }

        // State-based behavior
        switch (this.boss.state) {
            case 'walking':
                this.updateTurtleWalking(time);
                break;
            case 'squatting':
                // Waiting for squat animation, then fire
                break;
            case 'firing':
                // Waiting for fire, then resume walking
                break;
            case 'stalled':
            case 'stalled-critical':
                // Turrets handle combat, turtle just smokes
                this.updateSmokeEffect();
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

        // Check if time to fire
        if (time > this.boss.lastFireTime + this.boss.fireCooldown) {
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
        // Fire missile upward from turtle's launcher
        const missile = this.magneticMissiles.create(this.boss.x, this.boss.y - 50, 'boss-missile');
        missile.setScale(0.8);
        missile.setDepth(9);
        missile.setVelocity(0, -200);  // Fire upward
        missile.body.setSize(30, 40);

        // Magnetic properties
        missile.isMagnetic = true;
        missile.orbitAngle = 0;
        missile.orbitRadius = 0;
        missile.isOrbiting = false;
        missile.magneticStrength = 0.15;  // Easy orbit (low = easier to orbit)
    }

    updateMagneticMissiles() {
        this.magneticMissiles.getChildren().forEach(missile => {
            if (!missile.active) return;

            const distToPlayer = Phaser.Math.Distance.Between(
                missile.x, missile.y,
                this.player.x, this.player.y
            );

            // Magnetic pull range
            const magnetRange = 180;

            if (distToPlayer < magnetRange) {
                // Calculate gravitational pull toward player
                const angle = Phaser.Math.Angle.Between(
                    missile.x, missile.y,
                    this.player.x, this.player.y
                );

                // Apply pull force (inverse square, but capped for gameplay)
                const pullStrength = missile.magneticStrength * (magnetRange - distToPlayer);

                // Get current velocity
                let vx = missile.body.velocity.x;
                let vy = missile.body.velocity.y;

                // Add gravitational pull
                vx += Math.cos(angle) * pullStrength;
                vy += Math.sin(angle) * pullStrength;

                // Cap maximum speed
                const maxSpeed = 350;
                const currentSpeed = Math.sqrt(vx * vx + vy * vy);
                if (currentSpeed > maxSpeed) {
                    vx = (vx / currentSpeed) * maxSpeed;
                    vy = (vy / currentSpeed) * maxSpeed;
                }

                missile.setVelocity(vx, vy);

                // Rotate missile to face direction
                missile.setRotation(Math.atan2(vy, vx) + Math.PI / 2);

                // Check if orbiting (close but perpendicular velocity)
                if (distToPlayer < 80 && distToPlayer > 30) {
                    missile.isOrbiting = true;
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

        // Setup turret shooting
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

    updateSmokeEffect() {
        // Handled by timer in enterStalledPhase
    }

    defeatTurtleBoss() {
        if (this.boss.state === 'dead') return;
        this.boss.state = 'dead';

        // Stop timers
        if (this.boss.smokeTimer) this.boss.smokeTimer.remove();
        if (this.turretUpdateEvent) this.turretUpdateEvent.remove();

        // Destroy turrets
        this.boss.stalledTurrets.forEach(t => t.destroy());

        // Play death animation
        this.boss.setVelocity(0, 0);
        this.boss.play('turtle-death');

        // Multiple explosions
        for (let i = 0; i < 10; i++) {
            this.time.delayedCall(i * 150, () => {
                const ex = this.boss.x + Phaser.Math.Between(-60, 60);
                const ey = this.boss.y + Phaser.Math.Between(-40, 40);
                this.createExplosion(ex, ey, 'large');
                this.cameras.main.shake(100, 0.02);
            });
        }

        // Victory after explosions
        this.time.delayedCall(1800, () => {
            this.add.text(400, 200, 'TURTLE MECH DEFEATED!', {
                fontFamily: 'monospace',
                fontSize: '32px',
                fill: '#00ff00',
                stroke: '#000',
                strokeThickness: 4
            }).setOrigin(0.5).setDepth(100);

            // Add restart button
            const restartBtn = this.add.text(400, 260, '[ FIGHT AGAIN ]', {
                fontFamily: 'monospace',
                fontSize: '18px',
                fill: '#ffff00',
                stroke: '#000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(100).setInteractive({ useHandCursor: true });
            restartBtn.on('pointerover', () => restartBtn.setScale(1.1));
            restartBtn.on('pointerout', () => restartBtn.setScale(1));
            restartBtn.on('pointerdown', () => this.scene.restart({ boss: 'turtle' }));

            // Add menu button
            const menuBtn = this.add.text(400, 300, '[ MAIN MENU ]', {
                fontFamily: 'monospace',
                fontSize: '18px',
                fill: '#aaddff',
                stroke: '#000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(100).setInteractive({ useHandCursor: true });
            menuBtn.on('pointerover', () => menuBtn.setScale(1.1));
            menuBtn.on('pointerout', () => menuBtn.setScale(1));
            menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
        });
    }

    // ============== ZEPPELIN BOSS (for comparison) ==============

    spawnZeppelinBoss() {
        this.bossType = 'zeppelin';
        this.bossNameText.setText('ZEPPELIN');

        this.boss = this.physics.add.sprite(650, 200, 'boss-zeppelin');
        this.boss.setScale(1.5);
        this.boss.setDepth(5);

        this.boss.maxHealth = 100;
        this.boss.health = this.boss.maxHealth;

        this.boss.body.setSize(400, 250);
    }

    // ============== COCONUT BOUNCE ==============

    hitTurtleWithCoconut(coconut, boss) {
        if (this.bossType !== 'turtle') return;

        // Check if coconut hit from above (bounce)
        const hitFromAbove = coconut.y < boss.y - 30;

        if (hitFromAbove) {
            // Bounce the coconut
            coconut.setVelocity(
                Phaser.Math.Between(-100, 100),
                -200  // Bounce upward
            );

            // Reduced damage (25%)
            const damage = 5 * 0.25;  // Normal coconut does 5 damage
            boss.health -= damage;

            // Spark effect
            this.createBounceEffect(coconut.x, coconut.y);

            // Sound feedback
            this.cameras.main.shake(50, 0.005);
        } else {
            // Side/back hit - normal damage
            boss.health -= 5;
            coconut.destroy();
            this.createExplosion(coconut.x, coconut.y, 'small');
        }

        this.updateBossHealthBar();
    }

    createBounceEffect(x, y) {
        // Spark particles
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

    // ============== BOOMERANG BOUNCES OFF TURTLE ==============

    hitTurtleWithBoomerang(boomerang, boss) {
        // Boomerangs harmlessly bounce off turtle's shell!
        // Visual feedback - sparks
        this.createBounceEffect(boomerang.x, boomerang.y);

        // Brief gray tint instead of red
        boss.setTint(0x888888);
        this.time.delayedCall(100, () => {
            if (boss && boss.active) boss.clearTint();
        });

        // Slight camera feedback
        this.cameras.main.shake(30, 0.005);

        // Bounce the boomerang away
        const bounceAngle = Phaser.Math.Angle.Between(boss.x, boss.y, boomerang.x, boomerang.y);
        boomerang.setVelocity(
            Math.cos(bounceAngle) * 300,
            Math.sin(bounceAngle) * 300
        );
        boomerang.isReturning = false; // Reset so it doesn't home back immediately

        // Make it return after a short delay
        this.time.delayedCall(200, () => {
            if (boomerang && boomerang.active) {
                boomerang.isReturning = true;
                boomerang.homingStrength = 15;
            }
        });
    }

    // ============== MISSILE HITS TURTLE ==============

    missileHitsTurtle(missile, boss) {
        // Reflected missile does bonus damage!
        const bonusDamage = boss.maxHealth / 6;  // Dies in 6 hits
        boss.health -= bonusDamage;

        missile.destroy();
        this.createExplosion(missile.x, missile.y, 'large');
        this.cameras.main.shake(150, 0.02);

        this.updateBossHealthBar();
    }

    // ============== SHARED FUNCTIONS ==============

    handleBoomerang(time) {
        if (this.boomerangOut || time < this.lastBoomerangTime + this.boomerangCooldown) return;

        this.boomerangOut = true;
        this.lastBoomerangTime = time;

        const boomerang = this.boomerangs.create(this.player.x + 30, this.player.y, 'boomerang');
        boomerang.setScale(1.0);
        boomerang.setDepth(10);
        boomerang.body.setSize(60, 60);

        boomerang.isReturning = false;
        boomerang.homingStrength = 0;

        const angle = Phaser.Math.Angle.Between(
            this.player.x, this.player.y,
            this.mouseX, this.mouseY
        );

        boomerang.setVelocity(
            Math.cos(angle) * 500,
            Math.sin(angle) * 500
        );

        this.time.delayedCall(400, () => {
            if (boomerang.active) {
                boomerang.isReturning = true;
                boomerang.homingStrength = 15;
            }
        });
    }

    setupCollisions() {
        // Boomerang hits boss - turtle is immune (bounces), zeppelin takes damage
        this.physics.add.overlap(this.boomerangs, this.boss, (boomerang, boss) => {
            if (this.bossType === 'turtle') {
                // Turtle shell is immune to boomerangs - bounce off!
                this.hitTurtleWithBoomerang(boomerang, boss);
            } else {
                boss.health -= 5;
                this.updateBossHealthBar();
            }
        });

        // Coconut hits turtle boss  
        this.physics.add.overlap(this.coconuts, this.boss, (coconut, boss) => {
            if (this.bossType === 'turtle') {
                this.hitTurtleWithCoconut(coconut, boss);
            }
        });

        // Magnetic missile hits turtle (reflected)
        if (this.magneticMissiles) {
            this.physics.add.overlap(this.magneticMissiles, this.boss, (missile, boss) => {
                this.missileHitsTurtle(missile, boss);
            });
        }

        // Enemy bullets hit player
        this.physics.add.overlap(this.player, this.enemyBullets, (player, bullet) => {
            bullet.destroy();
            this.cameras.main.shake(100, 0.01);
        });

        // Magnetic missiles hit player
        if (this.magneticMissiles) {
            this.physics.add.overlap(this.player, this.magneticMissiles, (player, missile) => {
                missile.destroy();
                this.cameras.main.shake(150, 0.015);
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

    update(time, delta) {
        // Player movement
        if (this.cursors.up.isDown || this.wKey.isDown) {
            this.player.setVelocityY(-250);
        } else if (this.cursors.down.isDown || this.sKey.isDown) {
            this.player.setVelocityY(250);
        } else {
            this.player.setVelocityY(0);
        }

        // Drop coconut
        if (Phaser.Input.Keyboard.JustDown(this.fKey)) {
            const coconut = this.coconuts.create(this.player.x, this.player.y + 20, 'coconut');
            coconut.setScale(1.0);
            coconut.setDepth(5);
            coconut.setVelocityY(300);
            coconut.body.setSize(30, 30);
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

        // Update boss
        if (this.bossType === 'turtle') {
            this.updateTurtleBoss(time, delta);
        }
    }
}
