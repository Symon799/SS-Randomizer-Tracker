import styles from './Acknowledgement.module.css';

export default function Acknowledgement() {
    return (
        <div className={styles.ackContainer}>
            <div className={styles.primaryLine}>
                SSHD AP Tracker by{' '}
                <a href="https://github.com/Symon799">Symon799</a>
            </div>
            <div className={styles.secondaryLine}>
                Based on the original Skyward Sword tracker work by{' '}
                <a href="https://github.com/cjs8487">cjs07</a>, with major logic
                and architecture contributions from{' '}
                <a href="https://github.com/robojumper">robojumper</a> and map
                tracker work from{' '}
                <a href="https://github.com/youraveragelink">YourAverageLink</a>
                .
            </div>
        </div>
    );
}
