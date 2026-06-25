FROM node:18-slim

# Install Python and pip
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*

# Install python dependencies for Excel processing
RUN pip3 install pandas openpyxl --break-system-packages

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy all application source code
COPY . .

# Build the Vite React production bundle
RUN npm run build

# Expose port 5000
EXPOSE 5000

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Start the server
CMD ["npm", "start"]
