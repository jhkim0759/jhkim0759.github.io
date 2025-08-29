import * as THREE from 'https://unpkg.com/three@0.146.0/build/three.module.js';
import { OrbitControls } from './js/OrbitControls.js';
import { PLYLoader } from './js/PLYLoader.js';
import { NGonOBJLoader } from './NGonOBJLoader.js';
// import { materialOpacity } from 'three/webgpu';

// Fetch the manifest file
fetch('main_manifest.json')
    .then(response => response.json())
    .then(data => {
        const baseFiles = data.files; // List of base filenames
        initializeViewers(baseFiles);
    })
    .catch(error => console.error('Error fetching manifest:', error));


// Helper function to extract face number from filename
function extractFaceNumber(FilePath) {
    const filename = FilePath.substring(FilePath.lastIndexOf('/') + 1);
    const match = filename.match(/(\d+)F\./i);
    if (match && match[1]) {
        return match[1];
    } else {
        return 'Unknown';
    }
  }

function initializeViewers(baseFiles) {
    const gridContainer = document.querySelector('.grid-container');
    gridContainer.innerHTML = ''; // Clear existing containers

    // Add column labels
    const pcLabel = document.createElement('div');
    pcLabel.className = 'column-label';
    pcLabel.textContent = 'Point Cloud';
    gridContainer.appendChild(pcLabel);

    const meshLabel = document.createElement('div');
    meshLabel.className = 'column-label';
    meshLabel.textContent = 'Mesh';
    gridContainer.appendChild(meshLabel);

    const pcLabel2 = document.createElement('div');
    pcLabel2.className = 'column-label';
    pcLabel2.textContent = 'Point Cloud';
    gridContainer.appendChild(pcLabel2);

    const meshLabel2 = document.createElement('div');
    meshLabel2.className = 'column-label';
    meshLabel2.textContent = 'Mesh';
    gridContainer.appendChild(meshLabel2);

    baseFiles.forEach((baseName, index) => {
        // Calculate the grid row position (offset by 1 due to labels)
        // const rowIndex = Math.floor(index / 2) + 2; // Start from row 2
        // const rowIndex = Math.floor(index / 4) + 2; // Start from row 2
        // const rowIndex = 2;
        // Alternate between first and second set of columns
        // const colOffset = index % 2 === 0 ? 0 : 2;
        // const colOffset = index % 4 + 1;
        // const colOffset = index + 1;
        
        // Point Cloud
        if (baseName.endsWith('.ply')) {
            const pcContainerId = `pc_container${index + 1}`;
            const pcGridItem = document.createElement('div');
            pcGridItem.className = 'grid-item';
            // pcGridItem.style.gridColumn = `${colOffset}`;  // CSS grid start from 1 not 0
            // pcGridItem.style.gridRow = `${rowIndex}`;
    
            const pcMeshContainer = document.createElement('div');
            pcMeshContainer.className = 'mesh-container';
            pcMeshContainer.id = pcContainerId;
            pcGridItem.appendChild(pcMeshContainer);
    
            // Label
            const pcLabel = document.createElement('div');
            pcLabel.className = 'item-label';
            pcLabel.textContent = `Input`;
            pcGridItem.appendChild(pcLabel);
    
            // Download Button for Point Cloud
            // const pcDownloadButton = document.createElement('button');
            // pcDownloadButton.textContent = 'Download';
            // pcDownloadButton.onclick = () => {
            //     window.location.href = baseName;
            // };
            // pcGridItem.appendChild(pcDownloadButton);
            gridContainer.appendChild(pcGridItem);
            // Create viewers
            new PointCloudViewer(pcContainerId, baseName);
        } else {
            // Mesh
            const meshContainerId = `mesh_container${index + 1}`;
            const meshGridItem = document.createElement('div');
            meshGridItem.className = 'grid-item';
            // meshGridItem.style.gridColumn = colOffset;
            // meshGridItem.style.gridRow = `${rowIndex}`;

            const meshMeshContainer = document.createElement('div');
            meshMeshContainer.className = 'mesh-container';
            meshMeshContainer.id = meshContainerId;
            meshGridItem.appendChild(meshMeshContainer);

            // Extract the number of faces from the filename
            const faceNumber = extractFaceNumber(baseName);

            // Label
            const meshLabel = document.createElement('div');
            meshLabel.className = 'item-label';
            meshLabel.textContent = `Face count: ${faceNumber}`;
            meshGridItem.appendChild(meshLabel);

            // Download Button for Mesh
            // const meshDownloadButton = document.createElement('button');
            // meshDownloadButton.textContent = 'Download';
            // meshDownloadButton.onclick = () => {
            //     window.location.href = baseName;
            // };
            // meshGridItem.appendChild(meshDownloadButton);
            gridContainer.appendChild(meshGridItem);
            new MeshViewer(meshContainerId, baseName);
        }
    });

    // // Add window resize listener
    // window.addEventListener('resize', () => {
    //     viewers.forEach(viewer => {
    //         if (viewer.onWindowResize) {
    //             viewer.onWindowResize();
    //         }
    //     });
    // });
}

// MeshViewer class (same as script_quad.js with necessary adjustments)
class MeshViewer {
    constructor(containerId, objPath) {
        this.container = document.getElementById(containerId);
        this.objPath = objPath;

        if (!this.container) {
            console.error(`Container with ID '${containerId}' not found.`);
            return;
        }

        this.init();
        this.loadMesh();
        this.animate();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff); // Set background to white

        // Camera
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        this.camera.position.set(0, 0, 5);

        // Renderer (v2)
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio); // Improved pixel ratio
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding; // Gamma correction
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        this.container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.autoRotate = true;
        this.controls.enableDamping = true;

        // Lightning (v3)
        // Ambient Light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Increased intensity
        this.scene.add(ambientLight);
        // Hemisphere Light (Optional)
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
        hemisphereLight.position.set(0, 200, 0);
        this.scene.add(hemisphereLight);
        // Directional Light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Increased intensity
        directionalLight.position.set(5, 10, 7.5);
        // directionalLight.castShadow = true; // Enable shadows if needed
        this.scene.add(directionalLight);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1.0); // Increased intensity
        directionalLight2.position.set(-5, 0, -7.5);
        // directionalLight.castShadow = true; // Enable shadows if needed
        this.scene.add(directionalLight2);

        // const pointLight = new THREE.PointLight(0xffffff, 1, 0, 2);
        // pointLight.position.set(5, 10, 7.5);
        // this.scene.add(this.camera);
        // this.camera.add(pointLight);

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
    }

    loadMesh() {
        const loader = new NGonOBJLoader();
        loader.load(
            this.objPath,
            (ngon) => {
                const geometry = ngon.makeGeometry();
                const wireGeometry = ngon.makeWireGeometry();

                // Create mesh
                const material = new THREE.MeshStandardMaterial({
                    vertexColors: true,
                    side: THREE.DoubleSide,
                    metalness: 0.3,
                    roughness: 0.7,
                    polygonOffset: true,
                    polygonOffsetFactor: 1,
                });

                const mesh = new THREE.Mesh(geometry, material);

                // **Compute bounding box and center the mesh**
                geometry.computeBoundingBox();
                const boundingBox = geometry.boundingBox;
                const center = boundingBox.getCenter(new THREE.Vector3());

                // Reposition the mesh so that its center is at the origin
                mesh.position.sub(center);

                // **Adjust camera position and controls target**
                const size = boundingBox.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const fov = this.camera.fov * (Math.PI / 180);
                let cameraZ = maxDim / (2 * Math.tan(fov / 2));

                cameraZ *= 1.3; // Add some extra space around the object
                this.camera.position.set(0, 0, cameraZ);

                this.controls.target.copy(new THREE.Vector3(0, 0, 0));
                this.controls.update();

                // Add mesh to scene
                this.scene.add(mesh);

                // Add wireframe
                const wireMaterial = new THREE.LineBasicMaterial({ 
                    color: 0x000000, 
                    transparent: true,  // Enable transparency
                    opacity: 0.2        // Set opacity to 20%
                });
                const wireframe = new THREE.LineSegments(wireGeometry, wireMaterial);
                wireframe.position.copy(mesh.position);
                this.scene.add(wireframe);
            },
            undefined,
            (error) => {
                console.error('An error occurred while loading the OBJ file:', error);
            }
        );
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    createQuadWireframe(mesh) {
        const geometry = mesh.geometry;
        const position = geometry.attributes.position;
        const index = geometry.index;
      
        if (!index) {
          console.warn('Geometry does not have an index buffer.');
          return;
        }
      
        const edgeSet = new Set();
        const faces = [];
        const indices = index.array;
      
        // Reconstruct faces (triangles)
        for (let i = 0; i < indices.length; i += 3) {
          const a = indices[i];
          const b = indices[i + 1];
          const c = indices[i + 2];
          faces.push([a, b, c]);
        }
      
        // Map edges to faces
        const edgeToFaceMap = {};
      
        for (let i = 0; i < faces.length; i++) {
          const face = faces[i];
          const edges = [
            [face[0], face[1]],
            [face[1], face[2]],
            [face[2], face[0]],
          ];
      
          edges.forEach((edge) => {
            const sortedEdge = edge[0] < edge[1] ? [edge[0], edge[1]] : [edge[1], edge[0]];
            const key = sortedEdge.join('_');
      
            if (edgeToFaceMap[key]) {
              edgeToFaceMap[key].push(i);
            } else {
              edgeToFaceMap[key] = [i];
            }
          });
        }
      
        // Identify adjacent triangles forming quads
        const processedFaces = new Set();
        const quadEdges = [];
      
        for (const key in edgeToFaceMap) {
          const adjacentFaces = edgeToFaceMap[key];
          if (adjacentFaces.length === 2) {
            const [faceIndex1, faceIndex2] = adjacentFaces;
            if (processedFaces.has(faceIndex1) || processedFaces.has(faceIndex2)) continue;
      
            const face1 = faces[faceIndex1];
            const face2 = faces[faceIndex2];
      
            // Merge the two triangles into a quad
            const quadIndices = mergeTrianglesToQuad(face1, face2);
            if (quadIndices) {
              // Add edges of the quad
              quadEdges.push(
                quadIndices[0], quadIndices[1],
                quadIndices[1], quadIndices[2],
                quadIndices[2], quadIndices[3],
                quadIndices[3], quadIndices[0]
              );
      
              processedFaces.add(faceIndex1);
              processedFaces.add(faceIndex2);
            }
          }
        }
      
        // Remaining triangles that couldn't form quads
        for (let i = 0; i < faces.length; i++) {
          if (processedFaces.has(i)) continue;
      
          const face = faces[i];
          quadEdges.push(
            face[0], face[1],
            face[1], face[2],
            face[2], face[0]
          );
        }
      
        // Create wireframe geometry
        const wireframeGeometry = new THREE.BufferGeometry();
        wireframeGeometry.setAttribute('position', position);
        wireframeGeometry.setIndex(quadEdges);
      
        const wireframe = new THREE.LineSegments(
          wireframeGeometry,
          new THREE.LineBasicMaterial({ color: 0x000000 })
        );
      
        mesh.add(wireframe);
      }
    
      onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
    
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
    
        this.renderer.setSize(width, height);
      }
}

// PointCloudViewer class

class PointCloudViewer {
    constructor(containerId, plyPath) {
        this.container = document.getElementById(containerId);
        this.plyPath = plyPath;

        if (!this.container) {
            console.error(`Container with ID '${containerId}' not found.`);
            return;
        }

        this.init();
        this.loadPointCloud();
        this.animate();
    }

    init() {
        // Initialize scene, camera, renderer, controls
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff);

        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        this.camera.position.set(0, 0, 5);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio); // Improved pixel ratio
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding; // Gamma correction
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.autoRotate = true;
        this.controls.enableDamping = true;

        // Lightning (v3)
        // Ambient Light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Increased intensity
        this.scene.add(ambientLight);
        // Hemisphere Light (Optional)
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
        hemisphereLight.position.set(0, 200, 0);
        this.scene.add(hemisphereLight);
        // Directional Light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0); // Increased intensity
        directionalLight.position.set(5, 10, 7.5);
        directionalLight.castShadow = true; // Enable shadows if needed
        this.scene.add(directionalLight);

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
    }

    loadPointCloud() {
        const loader = new PLYLoader();
        loader.load(
            this.plyPath,
            (geometry) => {
                geometry.computeVertexNormals();
                const material = new THREE.PointsMaterial({ size: 0.005, color: 0x5A60FF });
                const points = new THREE.Points(geometry, material);

                // Center and adjust camera
                this.centerAndAdjustCamera(points, geometry);

                this.scene.add(points);
            },
            undefined,
            (error) => {
                console.error('An error occurred while loading the PLY file:', error);
            }
        );
    }

    centerAndAdjustCamera(points, geometry) {
        geometry.computeBoundingBox();
        const center = geometry.boundingBox.getCenter(new THREE.Vector3());
        points.position.sub(center);

        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = maxDim / (2 * Math.tan(fov / 2));
        cameraZ *= 1.5;

        this.camera.position.set(0, 0, cameraZ);
        this.controls.target.copy(new THREE.Vector3(0, 0, 0));
        this.controls.update();
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
    }
}