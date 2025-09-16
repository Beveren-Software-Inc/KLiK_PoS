### KLiK PoS

KLiK PoS: A Modern Point of Sale for your Business

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch develop
bench install-app klik_pos
```

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/klik_pos
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### License

mit


# KLiK PoS UI/SPA

A modern, responsive Point of Sale System built with React, TypeScript, and Vite. Designed for retail businesses with both desktop and mobile interfaces.

## Features

- 🏪 **Complete POS System** - Full retail point of sale functionality
- 📱 **Mobile-First Design** - Responsive UI that works on all devices
- 👥 **Customer Management** - Add, edit, and manage customer information
- 🛒 **Cart Management** - Intuitive cart with item management
- 💳 **Payment Processing** - Multiple payment methods support
- 📊 **Real-time Dashboard** - Sales analytics and reporting
- 🌐 **Multi-language Support** - Built-in internationalization
- 🌙 **Dark Mode** - Light and dark theme support
- 💾 **Offline Capable** - Works offline with data synchronization

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Routing**: React Router
- **Icons**: Lucide React
- **Backend Integration**: ERPNext API compatible

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/klik_spa.git
cd klik_spa
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Available Scripts

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn serve` - Preview production build
- `yarn lint` - Run ESLint

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Page components
├── hooks/         # Custom React hooks
├── stores/        # State management (Zustand)
├── services/      # API services
├── providers/     # Context providers
└── types/         # TypeScript type definitions
```

## Configuration

The application can be configured for different environments:

1. **Development**: Uses mock data and development APIs
   To fetch data currently:
   Go to providers -> FrappeProviders -> Change to your local token
   ```
     <FrappeProvider
        url="http://localhost:8000"
        tokenParams={() => ({
        useToken: true,
        token: "api_key:secret_key", 
        type: "token", 
      })}
    >
      {children}
    </FrappeProvider>
   ```
   Then for Item, Item Group, Sales Invoice, Contact- allow Guest to read.
   This will change in a few once we move to production.
3. **Production**: Connects to ERPNext backend
4. **Offline Mode**: Local storage fallback

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software. All rights reserved.

## Support

For support and questions, please contact the development team (info@beverensoftware.com).

