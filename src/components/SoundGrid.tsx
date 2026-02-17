import React from 'react';

const SoundGrid: React.FC = () => {
    return (
        <div className="sound-grid">
            {/* Render audio pads here */}
            <div className="audio-pad">Pad 1</div>
            <div className="audio-pad">Pad 2</div>
            <div className="audio-pad">Pad 3</div>
            <div className="audio-pad">Pad 4</div>
            {/* Add more pads as necessary */}
        </div>
    );
};

export default SoundGrid;
