export default class VictoryScene extends Phaser.Scene {
    constructor() {
        super({ key: 'VictoryScene' });
    }

    init(data) {
        this.finalScore = data.score || 0;
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Victory background
        this.bg = this.add.tileSprite(0, 0, width, height, 'bg-mountains')
            .setOrigin(0, 0);

        // Victory text
        const victory = this.add.text(width / 2, 80, 'VICTORY!', {
            fontFamily: 'monospace',
            fontSize: '64px',
            fill: '#ffdd00',
            stroke: '#ff6600',
            strokeThickness: 8
        }).setOrigin(0.5);

        // Rainbow effect
        this.tweens.add({
            targets: victory,
            scale: { from: 1, to: 1.1 },
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Subtitle
        this.add.text(width / 2, 140, 'The Boomerang Baron saves the day!', {
            fontFamily: 'monospace',
            fontSize: '18px',
            fill: '#ffffff',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // Triumphant biplane
        this.biplane = this.add.image(width / 2, height / 2 - 20, 'biplane');
        this.biplane.setScale(0.25);

        this.tweens.add({
            targets: this.biplane,
            y: { from: height / 2 - 30, to: height / 2 + 10 },
            angle: { from: -5, to: 5 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Final score
        this.add.text(width / 2, height / 2 + 80, `FINAL SCORE: ${this.finalScore}`, {
            fontFamily: 'monospace',
            fontSize: '32px',
            fill: '#ffff00',
            stroke: '#000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // High score check
        const highScore = parseInt(localStorage.getItem('redBaronHighScore')) || 0;
        if (this.finalScore > highScore) {
            localStorage.setItem('redBaronHighScore', this.finalScore);

            const newHS = this.add.text(width / 2, height / 2 + 120, '★ NEW HIGH SCORE! ★', {
                fontFamily: 'monospace',
                fontSize: '24px',
                fill: '#ff00ff',
                stroke: '#000',
                strokeThickness: 4
            }).setOrigin(0.5);

            this.tweens.add({
                targets: newHS,
                scale: { from: 1, to: 1.15 },
                duration: 400,
                yoyo: true,
                repeat: -1
            });
        }

        // Play again button
        const playBtn = this.add.text(width / 2, height - 80, '[ PLAY AGAIN ]', {
            fontFamily: 'monospace',
            fontSize: '28px',
            fill: '#00ff00',
            stroke: '#000',
            strokeThickness: 4
        }).setOrigin(0.5);

        playBtn.setInteractive({ useHandCursor: true });

        playBtn.on('pointerover', () => {
            playBtn.setScale(1.1);
            playBtn.setFill('#ffffff');
        });

        playBtn.on('pointerout', () => {
            playBtn.setScale(1);
            playBtn.setFill('#00ff00');
        });

        playBtn.on('pointerdown', () => {
            this.cameras.main.flash(500, 255, 255, 255);
            this.time.delayedCall(300, () => {
                this.scene.start('GameScene', { level: 1 });
            });
        });

        this.tweens.add({
            targets: playBtn,
            alpha: { from: 1, to: 0.7 },
            duration: 600,
            yoyo: true,
            repeat: -1
        });

        // Menu button
        const menuBtn = this.add.text(width / 2, height - 35, '[ MAIN MENU ]', {
            fontFamily: 'monospace',
            fontSize: '16px',
            fill: '#aaaaaa',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5);

        menuBtn.setInteractive({ useHandCursor: true });

        menuBtn.on('pointerover', () => menuBtn.setFill('#ffffff'));
        menuBtn.on('pointerout', () => menuBtn.setFill('#aaaaaa'));
        menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));

        // Keyboard shortcuts
        this.input.keyboard.once('keydown-SPACE', () => {
            this.cameras.main.flash(500, 255, 255, 255);
            this.time.delayedCall(300, () => {
                this.scene.start('GameScene', { level: 1 });
            });
        });
    }

    update() {
        this.bg.tilePositionX += 0.5;
    }
}
