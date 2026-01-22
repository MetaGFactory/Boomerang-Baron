export default class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
    }

    init(data) {
        this.finalScore = data.score || 0;
        this.level = data.level || 1;
        this.wave = data.wave || 1;
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Dark overlay
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);

        // Game Over text
        const gameOver = this.add.text(width / 2, 100, 'GAME OVER', {
            fontFamily: 'monospace',
            fontSize: '56px',
            fill: '#ff0000',
            stroke: '#000',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Flashing effect
        this.tweens.add({
            targets: gameOver,
            alpha: { from: 1, to: 0.5 },
            duration: 500,
            yoyo: true,
            repeat: -1
        });

        // Stats
        const statsY = 180;

        this.add.text(width / 2, statsY, `Final Score: ${this.finalScore}`, {
            fontFamily: 'monospace',
            fontSize: '24px',
            fill: '#ffcc00',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5);

        this.add.text(width / 2, statsY + 40, `Reached Level ${this.level} - Wave ${this.wave}`, {
            fontFamily: 'monospace',
            fontSize: '18px',
            fill: '#aaaaaa',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5);

        // High score
        const highScore = parseInt(localStorage.getItem('redBaronHighScore')) || 0;
        const isNewHighScore = this.finalScore >= highScore && this.finalScore > 0;

        if (isNewHighScore) {
            const newHS = this.add.text(width / 2, statsY + 90, '★ NEW HIGH SCORE! ★', {
                fontFamily: 'monospace',
                fontSize: '22px',
                fill: '#ffff00',
                stroke: '#000',
                strokeThickness: 3
            }).setOrigin(0.5);

            this.tweens.add({
                targets: newHS,
                scale: { from: 1, to: 1.1 },
                duration: 300,
                yoyo: true,
                repeat: -1
            });
        } else {
            this.add.text(width / 2, statsY + 90, `High Score: ${highScore}`, {
                fontFamily: 'monospace',
                fontSize: '18px',
                fill: '#888888',
                stroke: '#000',
                strokeThickness: 2
            }).setOrigin(0.5);
        }

        // Crashed biplane
        const biplane = this.add.image(width / 2, height / 2 + 30, 'biplane');
        biplane.setScale(0.2);
        biplane.setAngle(25);
        biplane.setTint(0x666666);

        // Retry button
        const retryBtn = this.add.text(width / 2, height - 100, '[ TRY AGAIN ]', {
            fontFamily: 'monospace',
            fontSize: '28px',
            fill: '#00ff00',
            stroke: '#000',
            strokeThickness: 4
        }).setOrigin(0.5);

        retryBtn.setInteractive({ useHandCursor: true });

        retryBtn.on('pointerover', () => {
            retryBtn.setScale(1.1);
            retryBtn.setFill('#ffffff');
        });

        retryBtn.on('pointerout', () => {
            retryBtn.setScale(1);
            retryBtn.setFill('#00ff00');
        });

        retryBtn.on('pointerdown', () => {
            this.cameras.main.flash(500, 255, 255, 255);
            this.time.delayedCall(300, () => {
                this.scene.start('GameScene', { level: 1 });
            });
        });

        // Pulsing effect
        this.tweens.add({
            targets: retryBtn,
            alpha: { from: 1, to: 0.7 },
            duration: 600,
            yoyo: true,
            repeat: -1
        });

        // Menu button
        const menuBtn = this.add.text(width / 2, height - 50, '[ MAIN MENU ]', {
            fontFamily: 'monospace',
            fontSize: '18px',
            fill: '#aaaaaa',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5);

        menuBtn.setInteractive({ useHandCursor: true });

        menuBtn.on('pointerover', () => {
            menuBtn.setFill('#ffffff');
        });

        menuBtn.on('pointerout', () => {
            menuBtn.setFill('#aaaaaa');
        });

        menuBtn.on('pointerdown', () => {
            this.scene.start('MenuScene');
        });

        // Keyboard shortcuts
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
    }
}
