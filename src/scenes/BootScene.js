export default class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Loading bar
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

        const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
            font: '20px monospace',
            fill: '#ffcc00'
        }).setOrigin(0.5, 0.5);

        const percentText = this.add.text(width / 2, height / 2, '0%', {
            font: '18px monospace',
            fill: '#ffffff'
        }).setOrigin(0.5, 0.5);

        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0x00ff00, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
            percentText.setText(parseInt(value * 100) + '%');
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            percentText.destroy();
        });

        // ============== PLAYER ==============
        // 4-frame spritesheet: idle, banking up, banking down, damaged (1376x344, 344x344 per frame)
        this.load.spritesheet('biplane', 'assets/sprites/biplane_4frames2.png', {
            frameWidth: 344,
            frameHeight: 344
        });

        // ============== PROJECTILES ==============
        this.load.image('boomerang', 'assets/sprites/boomerang.png');
        this.load.image('coconut', 'assets/sprites/coconut.png');
        this.load.image('pineapple', 'assets/sprites/pineapple.png');
        this.load.image('bullet', 'assets/sprites/bullet.png');
        this.load.image('egg', 'assets/sprites/egg.png');
        // Turret missile spritesheet: 2 frames (192x192 each), top=launch, bottom=flying
        this.load.spritesheet('turret-missile', 'assets/sprites/turret-missile.jpg.png', {
            frameWidth: 192,
            frameHeight: 192
        });

        // ============== ENEMIES ==============
        this.load.spritesheet('enemy-bird', 'assets/sprites/enemy-bird.png', {
            frameWidth: 64,
            frameHeight: 64
        });
        this.load.spritesheet('enemy-plane', 'assets/sprites/enemy-plane.png', {
            frameWidth: 96,
            frameHeight: 64
        });
        this.load.spritesheet('turret', 'assets/sprites/turret.png', {
            frameWidth: 64,
            frameHeight: 96
        });

        // ============== PARATROOPER & HELPER ==============
        this.load.spritesheet('paratrooper', 'assets/sprites/paratrooper.png', {
            frameWidth: 64,
            frameHeight: 96
        });
        // Helper plane (wingman) - 4 frames: idle, up, down, explode
        this.load.spritesheet('helper-plane', 'assets/sprites/wingman.png', {
            frameWidth: 128,
            frameHeight: 96
        });

        // ============== BOSS ==============
        this.load.image('boss-zeppelin', 'assets/sprites/boss-zeppelin.png');
        this.load.image('boss-missile', 'assets/sprites/boss-missile.png');
        this.load.image('boss-bomb', 'assets/sprites/boss-bomb.png');

        // ============== EFFECTS ==============
        this.load.spritesheet('explosion', 'assets/sprites/explosion.png', {
            frameWidth: 64,
            frameHeight: 64
        });
        this.load.spritesheet('explosion2', 'assets/sprites/explosion2.png', {
            frameWidth: 64,
            frameHeight: 64
        });

        // ============== PARALLAX BACKGROUNDS ==============
        // Menu background
        this.load.image('bg-mountains', 'assets/backgrounds/mountains.png');
        // Scene 1: Countryside
        this.load.image('scene1-bg', 'assets/backgrounds/sky.png');
        this.load.image('scene1-mid', 'assets/backgrounds/scene1-mid.png');
        this.load.image('scene1-fg', 'assets/backgrounds/scene1-fg.png');
        // Scene 2: Warzone
        this.load.image('scene2-bg', 'assets/backgrounds/scene2-bg.png');
        this.load.image('scene2-mid', 'assets/backgrounds/scene2-mid.png');
        this.load.image('scene2-fg', 'assets/backgrounds/scene2-fg.png');
        // Scene 3: Destruction (using scene2-mid temporarily until scene3-mid is fixed)
        this.load.image('scene3-bg', 'assets/backgrounds/scene3-bg.png');
        this.load.image('scene3-mid', 'assets/backgrounds/scene2-mid.png');
        this.load.image('scene3-fg', 'assets/backgrounds/scene3-fg.png');

        // ============== AUDIO ==============
        this.load.audio('overworld-theme', 'assets/sounds/Overworld theme1.wav');
        this.load.audio('boss-theme', 'assets/sounds/Boss Battle1.wav');

        // Wingman rescue voice lines
        this.load.audio('rescue-1', 'assets/sounds/apesstrongertogether1.wav');
        this.load.audio('rescue-2', 'assets/sounds/apesstrongertogether2.wav');
        this.load.audio('rescue-3', 'assets/sounds/Backup Here Charge!.wav');
        this.load.audio('rescue-4', 'assets/sounds/FromChutetoShooter1.wav');
        this.load.audio('rescue-5', 'assets/sounds/ThanksBaron1.wav');
        this.load.audio('rescue-6', 'assets/sounds/ThanksBaron2.wav');

        // Sound effects
        this.load.audio('zeppelin-approach', 'assets/sounds/Zeppelin approaches.wav');
        this.load.audio('banana-whip', 'assets/sounds/Banana whipshot1.wav');
        this.load.audio('propeller', 'assets/sounds/cartoonpropeller.wav');

        // Weapon and explosion sounds
        this.load.audio('coconut-bomb', 'assets/sounds/coconut_bomb.wav');
        this.load.audio('pineapple-shoot', 'assets/sounds/pineapple_shoot.wav');
        this.load.audio('bomb-explode', 'assets/sounds/bomb_explode.wav');
        this.load.audio('death-explosion', 'assets/sounds/death_explosion.wav');
        this.load.audio('bird-cry', 'assets/sounds/birdcry.wav');
        this.load.audio('plane-explode', 'assets/sounds/explosion1.wav');
        this.load.audio('zeppelin-down', 'assets/sounds/zepplindown.wav');
    }

    create() {
        // ============== ANIMATIONS ==============

        // Player biplane animations
        this.anims.create({
            key: 'biplane-idle',
            frames: this.anims.generateFrameNumbers('biplane', { start: 0, end: 0 }),
            frameRate: 1,
            repeat: -1
        });
        this.anims.create({
            key: 'biplane-up',
            frames: this.anims.generateFrameNumbers('biplane', { start: 1, end: 1 }),
            frameRate: 1,
            repeat: -1
        });
        this.anims.create({
            key: 'biplane-down',
            frames: this.anims.generateFrameNumbers('biplane', { start: 2, end: 2 }),
            frameRate: 1,
            repeat: -1
        });
        this.anims.create({
            key: 'biplane-damaged',
            frames: this.anims.generateFrameNumbers('biplane', { start: 3, end: 3 }),
            frameRate: 1,
            repeat: -1
        });

        // Enemy bird flapping
        this.anims.create({
            key: 'bird-fly',
            frames: this.anims.generateFrameNumbers('enemy-bird', { start: 0, end: 1 }),
            frameRate: 8,
            repeat: -1
        });

        // Enemy plane propeller
        this.anims.create({
            key: 'plane-fly',
            frames: this.anims.generateFrameNumbers('enemy-plane', { start: 0, end: 1 }),
            frameRate: 12,
            repeat: -1
        });

        // Turret animations
        this.anims.create({
            key: 'turret-idle',
            frames: this.anims.generateFrameNumbers('turret', { start: 0, end: 0 }),
            frameRate: 1,
            repeat: -1
        });
        this.anims.create({
            key: 'turret-fire',
            frames: this.anims.generateFrameNumbers('turret', { start: 1, end: 1 }),
            frameRate: 1,
            repeat: 0
        });

        // Paratrooper floating
        this.anims.create({
            key: 'paratrooper-float',
            frames: this.anims.generateFrameNumbers('paratrooper', { start: 0, end: 1 }),
            frameRate: 4,
            repeat: -1
        });

        // Helper plane (wingman) - matches biplane frames
        this.anims.create({
            key: 'wingman-idle',
            frames: this.anims.generateFrameNumbers('helper-plane', { start: 0, end: 0 }),
            frameRate: 1,
            repeat: -1
        });
        this.anims.create({
            key: 'wingman-up',
            frames: this.anims.generateFrameNumbers('helper-plane', { start: 1, end: 1 }),
            frameRate: 1,
            repeat: -1
        });
        this.anims.create({
            key: 'wingman-down',
            frames: this.anims.generateFrameNumbers('helper-plane', { start: 2, end: 2 }),
            frameRate: 1,
            repeat: -1
        });
        this.anims.create({
            key: 'wingman-explode',
            frames: this.anims.generateFrameNumbers('helper-plane', { start: 3, end: 3 }),
            frameRate: 1,
            repeat: 0
        });

        // Explosions
        this.anims.create({
            key: 'explode',
            frames: this.anims.generateFrameNumbers('explosion', { start: 0, end: 4 }),
            frameRate: 15,
            repeat: 0
        });
        this.anims.create({
            key: 'explode2',
            frames: this.anims.generateFrameNumbers('explosion2', { start: 0, end: 4 }),
            frameRate: 12,
            repeat: 0
        });

        // Turret missile animation (launch then flying)
        this.anims.create({
            key: 'turret-missile-fire',
            frames: this.anims.generateFrameNumbers('turret-missile', { start: 0, end: 1 }),
            frameRate: 8,
            repeat: -1
        });

        // Start menu scene
        this.scene.start('MenuScene');
    }
}
