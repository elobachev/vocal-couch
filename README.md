# 🎤 Vocal Coach - Interactive Voice Training App


## 📖 Description

Vocal Coach is a modern real-time voice training web application that helps users improve their pitch accuracy and develop musical ear. The application analyzes user's voice through microphone and compares it with reference notes from songs, providing instant feedback.

### ✨ Key Features

- **Real-time Pitch Feedback**: Accurate voice pitch analysis in real-time
- **Visual Display**: Interactive timeline with notes and accuracy indicators
- **Transposition**: Key adjustment to match different vocal ranges
- **Scoring System**: Automatic calculation of correctly sung notes
- **Responsive Design**: Full mobile device support
- **Song Collection**: Built-in songs with ability to add new ones
- **Audio Accompaniment**: Optional playback of reference notes

### 🎵 Included Songs

- **Twinkle Twinkle Little Star** 
- **Yankee Doodle**
- **Happy Birthday**


## 🚀 Installation and Setup

### Prerequisites

- Node.js version 16 or higher
- npm or yarn
- Modern web browser with Web Audio API support

### Clone and Install

```bash
# Clone the repository
git clone https://github.com/elobachev/vocal-couch.git
cd vocal-couch

# Install dependencies
npm install
```

### Development Scripts

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Command Structure

- `npm run dev` - Starts development server at http://localhost:5173
- `npm run build` - Creates optimized build in `dist/` folder
- `npm run preview` - Starts local server for testing production build

## 🎮 Usage

### Getting Started

1. Open the application in your browser
2. Press the "Play" button  and allow microphone access when first prompted


### Adding New Songs

....

### Creating and Importing Custom Songs

You can create your own songs and import them into Vocal Coach.

1. Prepare a **TSV file** containing the notes, timing, and lyrics split by syllables.  
   - Format: `start-end<TAB>Pitch<TAB>Syllable`  
   - Example:
     ```
     00:00:000-00:01:000   C4   Hel-
     00:01:000-00:02:000   D4   lo
     ```

2. Save your file with the `.tsv` extension.

3. Open Songs list and upload your `.tsv` file.


---

*Developed with MiniMax Agent - August 2025*
