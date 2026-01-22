export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Background with mountains
        this.bg = this.add.tileSprite(0, 0, width, height, 'bg-mountains')
            .setOrigin(0, 0);

        // Play propeller sound
        this.sound.play('propeller', { loop: true, volume: 0.1 });
        // Title container
        const titleY = 80;

        // Title shadow
        this.add.text(width / 2 + 3, titleY + 3, 'BOOMERANG BARON', {
            fontFamily: 'monospace',
            fontSize: '42px',
            fill: '#000000'
        }).setOrigin(0.5);

        // Title main
        const title = this.add.text(width / 2, titleY, 'BOOMERANG BARON', {
            fontFamily: 'monospace',
            fontSize: '42px',
            fill: '#ff3300',
            stroke: '#ffcc00',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(width / 2, titleY + 50, '~ Banana Warfare ~', {
            fontFamily: 'monospace',
            fontSize: '20px',
            fill: '#ffdd00',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // Pulsing title effect
        this.tweens.add({
            targets: title,
            scale: { from: 1, to: 1.05 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Floating biplane preview
        this.biplane = this.add.image(150, height / 2, 'biplane')
            .setScale(1.5);

        this.tweens.add({
            targets: this.biplane,
            y: { from: height / 2 - 20, to: height / 2 + 20 },
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Controls info
        const controlsY = height / 2 + 20;
        this.add.text(width / 2 + 100, controlsY - 60, 'CONTROLS:', {
            fontFamily: 'monospace',
            fontSize: '16px',
            fill: '#ffffff',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5);

        const controls = [
            'W/S or ↑/↓ - Move Up/Down',
            'SPACE - Fire Banana Boomerang',
            'F - Drop Coconut Bomb',
            'Q/E - Throw Pineapple Grenade',
            'Catch returning boomerang for POWER UP!'
        ];

        controls.forEach((text, i) => {
            this.add.text(width / 2 + 100, controlsY - 30 + (i * 22), text, {
                fontFamily: 'monospace',
                fontSize: '12px',
                fill: '#aaddff',
                stroke: '#000',
                strokeThickness: 1
            }).setOrigin(0.5);
        });

        // Start button
        const startBtn = this.add.text(width / 2, height - 80, '[ START MISSION ]', {
            fontFamily: 'monospace',
            fontSize: '28px',
            fill: '#00ff00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        startBtn.setInteractive({ useHandCursor: true });

        startBtn.on('pointerover', () => {
            startBtn.setScale(1.1);
            startBtn.setFill('#ffffff');
        });

        startBtn.on('pointerout', () => {
            startBtn.setScale(1);
            startBtn.setFill('#00ff00');
        });

        startBtn.on('pointerdown', () => {
            this.cameras.main.flash(500, 255, 255, 255);
            this.time.delayedCall(300, () => {
                this.scene.start('GameScene', { level: 1 });
            });
        });

        // Pulsing start button
        this.tweens.add({
            targets: startBtn,
            alpha: { from: 1, to: 0.7 },
            duration: 600,
            yoyo: true,
            repeat: -1
        });

        // Keyboard start
        this.input.keyboard.once('keydown-SPACE', () => {
            this.cameras.main.flash(500, 255, 255, 255);
            this.time.delayedCall(300, () => {
                this.scene.start('GameScene', { level: 1 });
            });
        });

        this.input.keyboard.once('keydown-ENTER', () => {
            this.cameras.main.flash(500, 255, 255, 255);
            this.time.delayedCall(300, () => {
                this.scene.start('GameScene', { level: 1 });
            });
        });

        // Version
        this.add.text(width - 10, height - 10, 'v1.0', {
            fontFamily: 'monospace',
            fontSize: '10px',
            fill: '#333333'
        }).setOrigin(1, 1);
    }

    update() {
        // Scroll background for preview effect
        this.bg.tilePositionX += 0.5;
    }
}
