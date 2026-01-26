export default class BlackBaronScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BlackBaronScene' });
    }

    init(data) {
        // Store game state passed from main game
        this.fromMainGame = data && data.fromMainGame || false;
        this.level = data && data.level || 3;
        this.score = data && data.score || 0;
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Start with cutscene
        this.showCutscene();
    }

    showCutscene() {
        // Flag to prevent multiple calls to startBattle
        this.cutsceneEnded = false;

        // Black background for cutscene
        const blackBg = this.add.rectangle(400, 225, 800, 450, 0x000000);
        blackBg.setDepth(99);

        // Fade in from the transition
        this.cameras.main.fadeIn(500, 0, 0, 0);

        // Create DOM video element (more reliable than Phaser video)
        const videoElement = document.createElement('video');
        videoElement.src = 'assets/Videos/BlackBaron.mp4';
        videoElement.style.position = 'absolute';
        videoElement.style.top = '0';
        videoElement.style.left = '0';
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'contain';
        videoElement.style.backgroundColor = 'black';
        videoElement.style.zIndex = '1000';
        videoElement.muted = true;  // Must be muted for autoplay
        videoElement.playsInline = true;

        // Get the game canvas parent and add video
        const gameContainer = this.game.canvas.parentElement;
        gameContainer.appendChild(videoElement);

        const endCutscene = () => {
            if (this.cutsceneEnded) return;
            this.cutsceneEnded = true;
            console.log('Ending cutscene, starting battle');

            // Remove video element
            if (videoElement && videoElement.parentNode) {
                videoElement.pause();
                videoElement.parentNode.removeChild(videoElement);
            }
            if (blackBg) blackBg.destroy();
            this.sound.stopAll();
            this.startBattle();
        };

        // Play PayloadOnWay audio 1 second after video starts
        this.time.delayedCall(1000, () => {
            if (this.cache.audio.exists('payload-ready') && !this.cutsceneEnded) {
                console.log('Playing PayloadOnWay audio');
                this.sound.play('payload-ready', { volume: 1.0 });
            }
        });

        // When video ends, start the battle
        videoElement.onended = () => {
            console.log('Video complete');
            endCutscene();
        };

        // Handle video errors
        videoElement.onerror = (e) => {
            console.warn('Video playback error:', e);
            endCutscene();
        };

        // Start video playback
        console.log('Starting video playback');
        videoElement.play().catch(e => {
            console.warn('Failed to play video:', e);
            endCutscene();
        });

        // Fallback timeout - skip cutscene after 15 seconds if video hangs
        this.time.delayedCall(15000, () => {
            if (!this.cutsceneEnded) {
                console.warn('Video timeout, skipping cutscene');
                endCutscene();
            }
        });

        // Skip cutscene with any key
        this.input.keyboard.once('keydown', () => {
            console.log('Key pressed, skipping cutscene');
            endCutscene();
        });
    }

    startBattle() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Background
        this.bg = this.add.tileSprite(0, 0, width, height, 'scene3-bg')
            .setOrigin(0, 0)
            .setDepth(0);

        // Create projectile groups
        this.boomerangs = this.physics.add.group();
        this.coconuts = this.physics.add.group();
        this.pineapples = this.physics.add.group();
        this.enemyBullets = this.physics.add.group();
        this.bossBombs = this.physics.add.group();

        // Create player (pushed to middle to avoid Black Baron behind)
        this.createPlayer();
        this.setupInput();

        // Player state
        this.boomerangOut = false;
        this.lastBoomerangTime = 0;
        this.boomerangCooldown = 300;
        this.lastCoconutTime = 0;
        this.coconutCooldown = 500;
        this.mouseX = width / 2;
        this.mouseY = height / 2;

        // Boomerang power system (like main game)
        this.boomerangPower = 1;
        this.maxBoomerangPower = 5;

        // Spawn Black Baron
        this.spawnBlackBaron();

        // Setup collisions
        this.setupCollisions();

        // Create UI
        this.createUI();

        // Play approach sound
        if (this.cache.audio.exists('black-baron-approach')) {
            this.sound.play('black-baron-approach', { volume: 0.5 });
        }

        // Play MasterOfSkies after 3 seconds
        this.time.delayedCall(3000, () => {
            if (this.cache.audio.exists('master-of-skies')) {
                this.sound.play('master-of-skies', { volume: 1.0 });
            }
        });

        // Instructions
        this.add.text(width / 2, 20, 'BLACK BARON BATTLE - Press ESC for Menu', {
            fontFamily: 'monospace',
            fontSize: '14px',
            fill: '#ffffff',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(100);

        // ESC to menu
        this.input.keyboard.on('keydown-ESC', () => {
            this.sound.stopAll();
            this.scene.start('MenuScene');
        });

        // DEBUG: X key to instantly kill boss for testing transitions
        this.input.keyboard.on('keydown-X', () => {
            if (this.boss && this.boss.active) {
                console.log('DEBUG: Killing Black Baron instantly');
                this.boss.health = 0;
                this.defeatBlackBaron();
            }
        });
    }

    createPlayer() {
        // Start player in middle of screen (pushed from left side due to Baron)
        this.player = this.physics.add.sprite(300, 225, 'biplane');
        this.player.setScale(0.35);
        this.player.setCollideWorldBounds(true);
        this.player.setDepth(10);
        this.player.body.setSize(140, 90);
        this.player.play('biplane-idle');

        // Player health
        this.playerHealth = 100;
        this.playerMaxHealth = 100;
    }

    setupInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });
        this.fKey = this.input.keyboard.addKey('F');

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

    spawnBlackBaron() {
        // Black Baron starts on left side behind player
        this.boss = this.physics.add.sprite(80, 225, 'boss-blackbaron');
        this.boss.setScale(0.4);
        this.boss.setDepth(8);
        this.boss.play('blackbaron-idle');
        this.boss.setFlipX(false); // Face left (flipped from original)

        // Boss stats - 500% more HP than before (200 * 6 = 1200)
        this.boss.maxHealth = 1200;
        this.boss.health = this.boss.maxHealth;

        // Phase system
        this.boss.phase = 'left-attack';  // left-attack, bottom-sweep, right-bomb, top-bomb
        this.boss.phaseTime = 0;
        this.boss.phaseDuration = 8000; // 8 seconds per phase

        // Movement
        this.boss.verticalDir = 1;
        this.boss.verticalSpeed = 90; // 50% faster (was 60)
        this.boss.sinOffset = 0;
        this.boss.sinAmplitude = 80; // Increases at 25% health

        // Shooting
        this.boss.lastShot = 0;
        this.boss.shootCooldown = 300;

        // Wingman (spawns at 50% health)
        this.wingman = null;
        this.wingmanSpawned = false;

        // Body for collisions
        this.boss.body.setSize(200, 150);
        this.boss.body.setImmovable(true);
    }

    setupCollisions() {
        // NOTE: Coconut collision is handled manually in checkCoconutBossCollision()
        // to avoid issues with Phaser's physics overlap double-firing

        // NOTE: Boomerang collision is handled manually in checkBoomerangBossCollision()
        // to avoid issues with Phaser's physics group sprite recycling

        // Pineapple hits boss
        this.physics.add.overlap(this.pineapples, this.boss, this.hitBossWithPineapple, null, this);

        // Player hit by enemy bullets
        this.physics.add.overlap(this.player, this.enemyBullets, this.playerHitByBullet, null, this);

        // Player hit by boss bombs
        this.physics.add.overlap(this.player, this.bossBombs, this.playerHitByBomb, null, this);
    }

    hitBossWithBoomerang(boomerang, boss) {
        if (boomerang.hasHitBoss) return;
        boomerang.hasHitBoss = true;

        // Boomerang damage scales with power level (10 + power * 5)
        const damage = 10 + (boomerang.power || 1) * 5;
        boss.health -= damage;

        // Play banana metal sound
        if (this.cache.audio.exists('banana-metal')) {
            this.sound.play('banana-metal', { volume: 0.5 });
        }

        // Visual feedback
        boss.setTint(0xffff00);
        this.time.delayedCall(100, () => {
            if (boss && boss.active) boss.clearTint();
        });

        this.cameras.main.shake(50, 0.01);
        this.updateBossHealthBar();

        // Check for death FIRST and return if dead
        if (boss.health <= 0) {
            this.defeatBlackBaron();
            return;
        }

        // Phase checks (only if boss is still alive)
        const healthPercent = boss.health / boss.maxHealth;
        if (healthPercent <= 0.5 && !this.wingmanSpawned) {
            this.spawnWingman();
        }
        if (healthPercent <= 0.25 && this.boss) {
            this.boss.sinAmplitude = 150;
        }
    }

    hitBossWithPineapple(pineapple, boss) {
        if (pineapple.hasHit) return;
        pineapple.hasHit = true;

        // Pineapple grenade deals 25 damage
        boss.health -= 25;

        // Play explosion sound
        if (this.cache.audio.exists('bomb-explode')) {
            this.sound.play('bomb-explode', { volume: 0.4 });
        }

        // Explosion effect
        this.createExplosion(pineapple.x, pineapple.y, 'large');
        pineapple.destroy();

        // Visual feedback
        boss.setTint(0xff6666);
        this.time.delayedCall(100, () => {
            if (boss && boss.active) boss.clearTint();
        });

        this.cameras.main.shake(100, 0.015);
        this.updateBossHealthBar();

        // Check for death FIRST and return if dead
        if (boss.health <= 0) {
            this.defeatBlackBaron();
            return;
        }

        // Phase checks (only if boss is still alive)
        const healthPercent = boss.health / boss.maxHealth;
        if (healthPercent <= 0.5 && !this.wingmanSpawned) {
            this.spawnWingman();
        }
        if (healthPercent <= 0.25 && this.boss) {
            this.boss.sinAmplitude = 150;
        }
    }

    hitBossWithCoconut(coconut, boss) {
        // Guard against invalid calls
        if (!boss || !boss.active) return;
        if (!coconut || !coconut.active) return;
        if (coconut.hasHit) return;
        coconut.hasHit = true;

        // Damage boss
        boss.health -= 20;

        // Play explosion
        this.sound.play('plane-explode', { volume: 0.4 });

        // Visual feedback
        this.createExplosion(coconut.x, coconut.y, 'small');
        boss.setTint(0xff6666);
        this.time.delayedCall(100, () => {
            if (boss && boss.active) boss.clearTint();
        });

        coconut.destroy();
        this.updateBossHealthBar();

        // Check for death FIRST and return if dead
        if (boss.health <= 0) {
            this.defeatBlackBaron();
            return;
        }

        // Check for phase changes (only if boss is still alive)
        const healthPercent = boss.health / boss.maxHealth;
        if (healthPercent <= 0.5 && !this.wingmanSpawned) {
            this.spawnWingman();
        }
        if (healthPercent <= 0.25 && this.boss) {
            this.boss.sinAmplitude = 150; // Larger sine wave
        }
    }

    playerHitByBullet(player, bullet) {
        if (this.isInvincible) return;

        this.playerHealth -= bullet.damage || 10;
        bullet.destroy();

        this.cameras.main.shake(100, 0.01);
        player.setTint(0xff0000);
        this.time.delayedCall(100, () => player.clearTint());

        // Play evil laugh when player takes damage
        if (this.cache.audio.exists('evil-laugh')) {
            this.sound.play('evil-laugh', { volume: 1.0 });
        }

        this.updatePlayerHealthBar();

        if (this.playerHealth <= 0) {
            this.playerDeath();
        } else {
            this.isInvincible = true;
            this.time.delayedCall(500, () => this.isInvincible = false);
        }
    }

    playerHitByBomb(player, bomb) {
        if (this.isInvincible) return;
        if (bomb.hasHit) return;
        bomb.hasHit = true;

        // Small bombs deal 1/3 damage (8 instead of 25)
        const damage = bomb.isSmallBomb ? 8 : 25;
        this.playerHealth -= damage;
        bomb.destroy();

        // Smaller explosion for small bombs
        this.createExplosion(bomb.x, bomb.y, bomb.isSmallBomb ? 'small' : 'small');
        this.cameras.main.shake(bomb.isSmallBomb ? 75 : 150, bomb.isSmallBomb ? 0.01 : 0.02);

        // Play evil laugh when player takes damage
        if (this.cache.audio.exists('evil-laugh')) {
            this.sound.play('evil-laugh', { volume: 1.0 });
        }

        this.updatePlayerHealthBar();

        if (this.playerHealth <= 0) {
            this.playerDeath();
        } else {
            this.isInvincible = true;
            this.time.delayedCall(bomb.isSmallBomb ? 500 : 1000, () => this.isInvincible = false);
        }
    }

    spawnWingman() {
        this.wingmanSpawned = true;

        // Play "Come now my minion" sound
        console.log('Wingman spawning! Checking audio...');
        try {
            this.sound.play('come-now-minion', { volume: 1.0 });
            console.log('Playing come-now-minion audio');
        } catch (e) {
            console.log('Audio error:', e);
        }

        this.wingman = this.physics.add.sprite(50, 150, 'boss-blackbaron');
        this.wingman.setScale(0.25); // Smaller than boss
        this.wingman.setDepth(7);
        this.wingman.play('blackbaron-idle');
        this.wingman.setFlipX(false); // Face left like the boss

        this.wingman.health = 50;
        this.wingman.lastShot = 0;
        this.wingman.shootCooldown = 800;

        // Wingman collision with coconuts
        this.physics.add.overlap(this.coconuts, this.wingman, (coconut, wingman) => {
            if (coconut.hasHit) return;
            coconut.hasHit = true;
            wingman.health -= 20;
            this.createExplosion(coconut.x, coconut.y, 'small');
            coconut.destroy();

            if (wingman.health <= 0) {
                this.createExplosion(wingman.x, wingman.y, 'large');
                wingman.destroy();
                this.wingman = null;
            }
        });

        // Wingman collision with boomerangs
        this.physics.add.overlap(this.boomerangs, this.wingman, (boomerang, wingman) => {
            if (boomerang.hasHitWingman) return;
            boomerang.hasHitWingman = true;
            wingman.health -= 10;
            if (this.cache.audio.exists('banana-metal')) {
                this.sound.play('banana-metal', { volume: 0.5 });
            }
            this.cameras.main.shake(30, 0.005);

            if (wingman.health <= 0) {
                this.createExplosion(wingman.x, wingman.y, 'large');
                wingman.destroy();
                this.wingman = null;
            }
        });

        // Wingman collision with pineapples
        this.physics.add.overlap(this.pineapples, this.wingman, (pineapple, wingman) => {
            if (pineapple.hasHitWingman) return;
            pineapple.hasHitWingman = true;
            wingman.health -= 25;
            this.createExplosion(pineapple.x, pineapple.y, 'small');
            pineapple.destroy();

            if (wingman.health <= 0) {
                this.createExplosion(wingman.x, wingman.y, 'large');
                wingman.destroy();
                this.wingman = null;
            }
        });
    }

    update(time, delta) {
        // Don't update if player is dead or boss is defeated
        if (this.playerDead) return;
        if (!this.boss || !this.player || !this.player.active) return;

        // Player movement
        this.handlePlayerMovement();
        this.updatePlayerAnimation();

        // Boss AI
        this.updateBlackBaron(time, delta);

        // Wingman AI
        if (this.wingman && this.wingman.active) {
            this.updateWingman(time);
        }

        // Background scroll
        this.bg.tilePositionX += 0.5;

        // Smoke effects for low health
        this.updateSmokeEffects(time);

        // Manual collision checks
        this.checkCoconutBossCollision();
        this.checkBoomerangBossCollision(); // Manual check for boomerang too
        this.checkPlayerBossCollision(); // Boss touching player deals damage

        // Update boomerang (return to player)
        this.updateBoomerang();

        // Handle coconut drop (spacebar)
        if (Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
            const now = this.time.now;
            if (now > this.lastCoconutTime + this.coconutCooldown) {
                this.dropCoconut();
                this.lastCoconutTime = now;
            }
        }

        // Handle pineapple attack (F key)
        if (Phaser.Input.Keyboard.JustDown(this.fKey)) {
            this.throwPineapple();
        }
    }

    handlePlayerMovement() {
        let velocityX = 0;
        let velocityY = 0;

        if (this.cursors.up.isDown || this.wasd.up.isDown) velocityY = -250;
        else if (this.cursors.down.isDown || this.wasd.down.isDown) velocityY = 250;
        if (this.cursors.left.isDown || this.wasd.left.isDown) velocityX = -250;
        else if (this.cursors.right.isDown || this.wasd.right.isDown) velocityX = 250;

        this.player.setVelocity(velocityX, velocityY);

        // Keep player in bounds but away from left edge (can't reach Baron on left)
        this.player.x = Phaser.Math.Clamp(this.player.x, 175, 750);
    }

    updatePlayerAnimation() {
        const vel = this.player.body.velocity;
        if (this.playerHealth < this.playerMaxHealth * 0.3) {
            this.player.play('biplane-damaged', true);
        } else if (vel.y < -50) {
            this.player.play('biplane-up', true);
        } else if (vel.y > 50) {
            this.player.play('biplane-down', true);
        } else {
            this.player.play('biplane-idle', true);
        }
    }

    updateBlackBaron(time, delta) {
        if (!this.boss || !this.boss.active) return;

        // Update animation based on vertical movement
        if (this.boss.body.velocity.y < -20) {
            this.boss.play('blackbaron-up', true);
        } else if (this.boss.body.velocity.y > 20) {
            this.boss.play('blackbaron-down', true);
        } else {
            if (this.boss.health < this.boss.maxHealth * 0.3) {
                this.boss.play('blackbaron-damaged', true);
            } else {
                this.boss.play('blackbaron-idle', true);
            }
        }

        // Phase timer
        this.boss.phaseTime += delta;
        if (this.boss.phaseTime >= this.boss.phaseDuration) {
            this.nextPhase();
        }

        // Execute current phase
        switch (this.boss.phase) {
            case 'left-attack':
                this.boss.setVelocityX(0); // No horizontal movement in this phase
                this.phaseLeftAttack(time);
                break;
            case 'bottom-sweep':
                this.phaseBottomSweep(time, delta);
                break;
            case 'right-bomb':
                this.boss.setVelocityX(0); // No horizontal movement in this phase
                this.phaseRightBomb(time);
                break;
            case 'top-bomb':
                this.phaseTopBomb(time);
                break;
        }

        // Clamp boss position to screen bounds
        this.boss.x = Phaser.Math.Clamp(this.boss.x, 50, 750);
        this.boss.y = Phaser.Math.Clamp(this.boss.y, 0, 400);
    }

    nextPhase() {
        this.boss.phaseTime = 0;

        const phases = ['left-attack', 'bottom-sweep', 'right-bomb', 'top-bomb'];
        const currentIndex = phases.indexOf(this.boss.phase);
        const nextIndex = (currentIndex + 1) % phases.length;
        this.boss.phase = phases[nextIndex];

        // Play sound for phase transitions
        if (this.boss.phase === 'right-bomb') {
            if (this.cache.audio.exists('time-to-down')) {
                this.sound.play('time-to-down', { volume: 1.0 });
            }
        } else if (this.boss.phase === 'top-bomb') {
            if (this.cache.audio.exists('zeppelins-inbound')) {
                this.sound.play('zeppelins-inbound', { volume: 1.0 });
            }
        }

        // Move to new position
        this.transitionToPhase();
    }

    transitionToPhase() {
        let targetX, targetY;

        switch (this.boss.phase) {
            case 'left-attack':
                targetX = 80;
                targetY = 225;
                this.boss.setFlipX(false); // Face left
                break;
            case 'bottom-sweep':
                targetX = 100;
                targetY = 380;
                this.boss.setFlipX(false); // Face left
                break;
            case 'right-bomb':
                targetX = 720;
                targetY = 225;
                this.boss.setFlipX(false); // Face left toward player
                break;
            case 'top-bomb':
                targetX = 400;
                targetY = 40; // 40 pixels higher (was 80)
                // Will update flip in phaseTopBomb based on movement direction
                break;
        }

        this.tweens.add({
            targets: this.boss,
            x: targetX,
            y: targetY,
            duration: 500,
            ease: 'Power2'
        });
    }

    phaseLeftAttack(time) {
        // Rapid, random vertical oscillation
        // Randomly change direction more frequently
        if (this.boss.y <= 80) {
            this.boss.verticalDir = 1;
        } else if (this.boss.y >= 370) {
            this.boss.verticalDir = -1;
        } else if (Math.random() < 0.05) {
            // 5% chance per frame to randomly reverse direction
            this.boss.verticalDir *= -1;
        }

        // Much faster oscillation (4.5x speed - 50% faster than 3x)
        const rapidSpeed = this.boss.verticalSpeed * 4.5;
        this.boss.setVelocityY(rapidSpeed * this.boss.verticalDir);

        // Shoot bullets at 50% reduced rate (2x cooldown)
        const reducedCooldown = this.boss.shootCooldown * 2;
        if (time > this.boss.lastShot + reducedCooldown) {
            this.bossShoot();
            this.boss.lastShot = time;
        }
    }

    phaseBottomSweep(time, delta) {
        // Sinusoidal movement - no shooting (player opportunity to bomb)
        this.boss.sinOffset += delta * 0.002;

        const baseY = 380;
        const amplitude = this.boss.sinAmplitude;
        const newY = baseY + Math.sin(this.boss.sinOffset) * amplitude;

        this.boss.y = Phaser.Math.Clamp(newY, 100, 420);
        this.boss.x += 2.25; // Move across screen (50% faster, was 1.5)

        if (this.boss.x > 750) this.boss.x = 50;

        this.boss.setVelocityY(0);
    }

    phaseRightBomb(time) {
        // Vertical oscillation
        if (this.boss.y <= 80) this.boss.verticalDir = 1;
        else if (this.boss.y >= 370) this.boss.verticalDir = -1;
        this.boss.setVelocityY(this.boss.verticalSpeed * 1.5 * this.boss.verticalDir); // 50% faster

        // Drop coconut bombs diagonally
        if (time > this.boss.lastShot + 1000) {
            this.bossDropBomb();
            this.boss.lastShot = time;
        }
    }

    phaseTopBomb(time) {
        // Horizontal movement - 50% faster (120 instead of 80)
        if (this.boss.x <= 100) this.boss.verticalDir = 1;
        else if (this.boss.x >= 700) this.boss.verticalDir = -1;
        this.boss.setVelocityX(240 * this.boss.verticalDir); // 50% faster (was 160)
        this.boss.setVelocityY(0);

        // Face OPPOSITE direction of movement (look back at player)
        // When moving right (verticalDir > 0), face left (flipX = false)
        // When moving left (verticalDir < 0), face right (flipX = true)
        this.boss.setFlipX(this.boss.verticalDir < 0);

        // Drop bombs 25% faster (1500ms instead of 2000ms)
        if (time > this.boss.lastShot + 1500) {
            this.bossDropBombDown();
            this.boss.lastShot = time;
        }
    }

    bossShoot() {
        const bullet = this.enemyBullets.create(this.boss.x + 30, this.boss.y, 'bullet');
        bullet.setScale(0.5);
        bullet.setVelocityX(300);
        bullet.damage = 10;
        bullet.setDepth(5);
    }

    bossDropBomb() {
        const bomb = this.bossBombs.create(this.boss.x - 20, this.boss.y + 20, 'boss-bomb');
        bomb.setScale(0.8);
        bomb.setVelocity(-150, 100); // Diagonal left
        bomb.setDepth(5);
        bomb.isMainBomb = true;
        bomb.hasHit = false;

        // After 0.2 seconds, split into 3 smaller bombs
        this.time.delayedCall(200, () => {
            if (bomb && bomb.active) {
                this.splitBomb(bomb);
            }
        });
    }

    bossDropBombDown() {
        const bomb = this.bossBombs.create(this.boss.x, this.boss.y + 30, 'boss-bomb');
        bomb.setScale(0.6);
        bomb.setVelocityY(200);
        bomb.setDepth(5);
        bomb.isMainBomb = true; // Mark as main bomb for splitting
        bomb.hasHit = false;

        // After 1 second, split into 3 smaller bombs
        this.time.delayedCall(600, () => {
            if (bomb && bomb.active) {
                this.splitBomb(bomb);
            }
        });
    }

    splitBomb(bomb) {
        const x = bomb.x;
        const y = bomb.y;
        bomb.destroy();

        // Create 3 smaller bombs spreading in different directions
        const angles = [-45, 0, 45]; // Left, center, right
        angles.forEach(angle => {
            const smallBomb = this.bossBombs.create(x, y, 'boss-bomb');
            smallBomb.setScale(0.35); // Smaller
            smallBomb.setDepth(5);
            smallBomb.isSmallBomb = true; // Mark as fragment
            smallBomb.hasHit = false;

            // Calculate velocity based on angle
            const rad = Phaser.Math.DegToRad(angle);
            smallBomb.setVelocity(
                Math.sin(rad) * 100,  // Horizontal spread
                150 + Math.abs(angle) // Faster fall for angled ones
            );
        });
    }

    updateWingman(time) {
        // Wingman follows on left side, shoots occasionally
        if (this.wingman.y <= 80) this.wingman.verticalDir = 1;
        else if (this.wingman.y >= 370) this.wingman.verticalDir = -1;

        this.wingman.y += (this.wingman.verticalDir || 1) * 1.5;

        if (time > this.wingman.lastShot + this.wingman.shootCooldown) {
            const bullet = this.enemyBullets.create(this.wingman.x + 20, this.wingman.y, 'bullet');
            bullet.setScale(0.3); // Smaller bullets
            bullet.setVelocityX(250);
            bullet.damage = 5; // Reduced damage
            this.wingman.lastShot = time;
        }
    }

    throwBoomerang() {
        if (this.boomerangOut) return;
        const now = this.time.now;
        if (now < this.lastBoomerangTime + this.boomerangCooldown) return;

        this.boomerangOut = true;
        this.lastBoomerangTime = now;

        this.sound.play('banana-whip', { volume: 0.15 });

        // Use getFirstDead to properly handle sprite recycling
        let boomerang = this.boomerangs.getFirstDead(false);
        if (!boomerang) {
            boomerang = this.boomerangs.create(this.player.x + 30, this.player.y, 'boomerang');
        } else {
            boomerang.setActive(true);
            boomerang.setVisible(true);
            boomerang.setPosition(this.player.x + 30, this.player.y);
            boomerang.body.enable = true;
        }

        boomerang.setScale(0.8 + (this.boomerangPower * 0.1)); // Scale with power
        boomerang.setDepth(5);
        boomerang.power = this.boomerangPower; // Store power level for damage calculation
        boomerang.isReturning = false;
        boomerang.hasHitBoss = false; // Reset hit flag for recycled sprites
        boomerang.hasHitWingman = false; // Reset wingman hit flag too
        boomerang.setAngle(0); // Reset rotation

        // Speed and distance scale with power
        const speed = 400 + (this.boomerangPower * 50);
        boomerang.setVelocity(speed, 0); // Fire straight right
        boomerang.body.setSize(60, 60);

        // After 400ms, start returning
        this.time.delayedCall(400, () => {
            if (boomerang.active) {
                boomerang.isReturning = true;
            }
        });

        this.activeBoomerang = boomerang;
    }

    updateBoomerang() {
        if (!this.activeBoomerang || !this.activeBoomerang.active) {
            this.boomerangOut = false;
            return;
        }

        const boomerang = this.activeBoomerang;

        // Spin animation
        boomerang.angle += 25;

        if (boomerang.isReturning) {
            // Home back to player
            const angle = Phaser.Math.Angle.Between(
                boomerang.x, boomerang.y,
                this.player.x, this.player.y
            );
            const speed = 400;
            boomerang.setVelocity(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed
            );

            // Check if caught by player
            const dist = Phaser.Math.Distance.Between(
                boomerang.x, boomerang.y,
                this.player.x, this.player.y
            );
            if (dist < 40) {
                // CAUGHT! Power up!
                this.boomerangPower = Math.min(this.boomerangPower + 1, this.maxBoomerangPower);
                this.showCatchEffect();
                boomerang.destroy();
                this.activeBoomerang = null;
                this.boomerangOut = false;
                return;
            }
        }

        // Destroy if off screen - POWER RESET!
        if (boomerang.x > 850 || boomerang.x < -50 || boomerang.y < -50 || boomerang.y > 500) {
            // MISSED! Power resets to 1
            this.boomerangPower = 1;
            this.showMissEffect();
            boomerang.destroy();
            this.activeBoomerang = null;
            this.boomerangOut = false;
        }
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

        // Flash player yellow
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

    dropCoconut() {
        const coconut = this.coconuts.create(this.player.x, this.player.y + 20, 'coconut');
        coconut.setScale(1.0);
        coconut.setDepth(5);
        coconut.setVelocityY(300);
        coconut.body.setSize(30, 30);
        coconut.hasHit = false; // Reset hit flag for recycled sprites

        if (this.cache.audio.exists('coconut-bomb')) {
            this.sound.play('coconut-bomb', { volume: 0.17 });
        }
    }

    throwPineapple() {
        const pineapple = this.pineapples.create(this.player.x + 30, this.player.y, 'pineapple');
        pineapple.setScale(0.5);
        pineapple.setDepth(5);
        pineapple.setVelocityX(400);
        pineapple.body.setSize(40, 40);
        pineapple.hasHit = false; // Reset hit flag for recycled sprites
        pineapple.hasHitWingman = false; // Reset wingman hit flag too

        if (this.cache.audio.exists('pineapple-shoot')) {
            this.sound.play('pineapple-shoot', { volume: 0.375 });
        }
    }

    checkCoconutBossCollision() {
        if (!this.boss || !this.boss.active) return;

        this.coconuts.getChildren().forEach(coconut => {
            if (coconut.hasHit) return;

            const dist = Phaser.Math.Distance.Between(
                coconut.x, coconut.y,
                this.boss.x, this.boss.y
            );

            if (dist < 80) {
                this.hitBossWithCoconut(coconut, this.boss);
            }
        });
    }

    checkBoomerangBossCollision() {
        if (!this.boss || !this.boss.active) return;
        if (!this.activeBoomerang || !this.activeBoomerang.active) return;

        const boomerang = this.activeBoomerang;

        // Skip if this boomerang already hit the boss
        if (boomerang.hasHitBoss) return;

        const dist = Phaser.Math.Distance.Between(
            boomerang.x, boomerang.y,
            this.boss.x, this.boss.y
        );

        if (dist < 100) {
            // Mark as hit and deal damage
            boomerang.hasHitBoss = true;

            // Boomerang damage scales with power level (10 + power * 5)
            const damage = 10 + (boomerang.power || 1) * 5;
            this.boss.health -= damage;

            // Play banana metal sound
            if (this.cache.audio.exists('banana-metal')) {
                this.sound.play('banana-metal', { volume: 0.5 });
            }

            // Visual feedback
            this.boss.setTint(0xffff00);
            this.time.delayedCall(100, () => {
                if (this.boss && this.boss.active) this.boss.clearTint();
            });

            this.cameras.main.shake(50, 0.01);
            this.updateBossHealthBar();

            // Check for death FIRST and return if dead
            if (this.boss.health <= 0) {
                this.defeatBlackBaron();
                return;
            }

            // Phase checks (only if boss is still alive)
            const healthPercent = this.boss.health / this.boss.maxHealth;
            if (healthPercent <= 0.5 && !this.wingmanSpawned) {
                this.spawnWingman();
            }
            if (healthPercent <= 0.25 && this.boss) {
                this.boss.sinAmplitude = 150;
            }
        }
    }

    checkPlayerBossCollision() {
        if (!this.boss || !this.boss.active) return;
        if (!this.player || !this.player.active) return;
        if (this.isInvincible) return;

        const dist = Phaser.Math.Distance.Between(
            this.player.x, this.player.y,
            this.boss.x, this.boss.y
        );

        // Collision radius - boss is big
        if (dist < 80) {
            // Player takes 15 damage from boss collision
            this.playerHealth -= 15;

            this.cameras.main.shake(150, 0.02);
            this.player.setTint(0xff0000);
            this.time.delayedCall(100, () => this.player.clearTint());

            this.updatePlayerHealthBar();

            if (this.playerHealth <= 0) {
                this.playerDeath();
            } else {
                this.isInvincible = true;
                this.time.delayedCall(1000, () => this.isInvincible = false);
            }
        }
    }

    updateSmokeEffects(time) {
        if (!this.lastSmokeTime) this.lastSmokeTime = 0;
        if (time < this.lastSmokeTime + 100) return; // Spawn smoke every 100ms
        this.lastSmokeTime = time;

        // Player smoke when at 25% health or lower
        if (this.player && this.player.active && this.playerHealth <= this.playerMaxHealth * 0.25) {
            this.createSmoke(this.player.x - 30, this.player.y);
        }

        // Boss smoke when at 25% health or lower
        if (this.boss && this.boss.active && this.boss.health <= this.boss.maxHealth * 0.25) {
            this.createSmoke(this.boss.x - 40, this.boss.y);
        }
    }

    createSmoke(x, y) {
        const smoke = this.add.circle(
            x + Phaser.Math.Between(-10, 10),
            y + Phaser.Math.Between(-8, 8),
            Phaser.Math.Between(8, 18),
            0x333333,
            0.8
        );
        smoke.setDepth(15);

        this.tweens.add({
            targets: smoke,
            alpha: 0,
            scale: 2.5,
            x: smoke.x - 50,
            y: smoke.y - 20,
            duration: 600,
            onComplete: () => smoke.destroy()
        });
    }

    createUI() {
        // Player health bar
        this.add.rectangle(100, 430, 150, 16, 0x333333).setDepth(100);
        this.playerHealthBar = this.add.rectangle(27, 430, 144, 12, 0x00ff00)
            .setOrigin(0, 0.5).setDepth(100);
        this.add.rectangle(100, 430, 150, 16).setStrokeStyle(2, 0xffffff).setDepth(100);
        this.add.text(100, 412, 'PLAYER', {
            fontFamily: 'monospace', fontSize: '10px', fill: '#fff'
        }).setOrigin(0.5).setDepth(100);

        // Boss health bar
        this.add.rectangle(400, 60, 400, 20, 0x333333).setDepth(100);
        this.bossHealthBar = this.add.rectangle(202, 60, 396, 16, 0xff0000)
            .setOrigin(0, 0.5).setDepth(100);
        this.add.rectangle(400, 60, 400, 20).setStrokeStyle(2, 0xffffff).setDepth(100);
        this.add.text(400, 42, 'BLACK BARON', {
            fontFamily: 'monospace', fontSize: '12px', fill: '#ff0000', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(100);
    }

    updatePlayerHealthBar() {
        const percent = this.playerHealth / this.playerMaxHealth;
        this.playerHealthBar.scaleX = Math.max(0, percent);
    }

    updateBossHealthBar() {
        const percent = this.boss.health / this.boss.maxHealth;
        this.bossHealthBar.scaleX = Math.max(0, percent);
    }

    createExplosion(x, y, size) {
        const explosion = this.add.sprite(x, y, 'explosion');
        explosion.setScale(size === 'large' ? 1.5 : 0.8);
        explosion.setDepth(20);
        explosion.play('explode');
        explosion.on('animationcomplete', () => explosion.destroy());
    }

    playerDeath() {
        if (this.playerDead) return; // Prevent multiple calls
        this.playerDead = true;

        this.createExplosion(this.player.x, this.player.y, 'large');
        this.player.setActive(false);
        this.player.setVisible(false);
        this.sound.stopAll();

        this.add.text(400, 200, 'DEFEATED BY BLACK BARON!', {
            fontFamily: 'monospace', fontSize: '28px', fill: '#ff0000',
            stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(100);

        this.time.delayedCall(2000, () => {
            this.scene.start('MenuScene');
        });
    }

    defeatBlackBaron() {
        this.boss.setVelocity(0, 0);
        this.boss.play('blackbaron-damaged');

        // Explosion sequence
        for (let i = 0; i < 10; i++) {
            this.time.delayedCall(i * 150, () => {
                if (!this.boss) return;
                this.createExplosion(
                    this.boss.x + Phaser.Math.Between(-50, 50),
                    this.boss.y + Phaser.Math.Between(-50, 50),
                    'large'
                );
                this.sound.play('bomb-explode', { volume: 0.3 });
                this.cameras.main.shake(100, 0.02);
            });
        }

        this.time.delayedCall(1500, () => {
            if (this.boss) {
                this.boss.destroy();
                this.boss = null;
            }
            if (this.wingman) {
                this.wingman.destroy();
                this.wingman = null;
            }

            this.sound.stopAll();
            // Note: Victory sound is played in VictoryScene, not here

            this.add.text(400, 180, 'BLACK BARON DEFEATED!', {
                fontFamily: 'monospace', fontSize: '32px', fill: '#00ff00',
                stroke: '#000', strokeThickness: 4
            }).setOrigin(0.5).setDepth(100);

            // If we came from the main game, this is the final boss - go to victory!
            if (this.fromMainGame) {
                // Add boss defeat bonus to score
                const bossBonus = 10000 * this.level;  // Big bonus for final boss
                this.score += bossBonus;

                this.add.text(400, 220, 'FINAL BOSS BONUS: +' + bossBonus, {
                    fontFamily: 'monospace',
                    fontSize: '18px',
                    fill: '#ffff00',
                    stroke: '#000',
                    strokeThickness: 3
                }).setOrigin(0.5).setDepth(100);

                // After delay, go to victory scene
                this.time.delayedCall(3000, () => {
                    this.cameras.main.fadeOut(1000, 0, 0, 0);
                    this.cameras.main.once('camerafadeoutcomplete', () => {
                        this.scene.start('VictoryScene', { score: this.score });
                    });
                });
            } else {
                // Standalone boss test mode - show menu button
                const menuBtn = this.add.text(400, 240, '[ MAIN MENU ]', {
                    fontFamily: 'monospace', fontSize: '18px', fill: '#aaddff',
                    stroke: '#000', strokeThickness: 3
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
}
