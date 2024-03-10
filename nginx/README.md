# Required Files for nginx-pod

To deploy the nginx-pod, you need to provide the following three files:

1. nginx-certs.tar.gz:
   - This file contains the SSL/TLS certificates and keys required by Nginx for HTTPS communication.
   - Ensure that the tar archive includes the necessary certificates and keys in the appropriate directory structure.
   - Example:
     ```
     nginx-certs/
     ├── cert.pem
     ├── key.pem
     ```

2. nginx-config.tar.gz:
   - This file contains the Nginx configuration files.
   - Ensure that the tar archive includes the required Nginx configuration files in the appropriate directory structure.
   - Example:
     ```
     nginx-config/
     ├── nginx.conf
     ├── sites-available/
     │   └── example.com
     ├── sites-enabled/
     │   └── example.com -> ../sites-available/example.com
     ```

3. prayujt-website.tar.gz:
   - This file contains the static files or application code for the prayujt.com website.
   - Ensure that the tar archive includes the necessary files for the website in the appropriate directory structure.
   - The website structure typically includes:
     - Entry point HTML file
     - Various assets such as images, stylesheets, and JavaScript files
     - Additional configuration files like `robots.txt` or `manifest.json`
   - Example:
     ```
     prayujt-website/
     ├── index.html           # Entry point HTML file
     ├── assets/             # Assets folder (e.g., CSS, JavaScript, images)
     │   ├── styles.css      # Compiled CSS file
     │   └── script.js       # Compiled JavaScript file
     ├── favicon.ico
     ├── logo.png
     ├── robots.txt
     ```

Ensure that these files are provided and properly formatted before deploying the nginx-pod.

