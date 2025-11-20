# Three.js r164.1 OBJExporter 源码分析报告

## 1. 源码 (r164.1)

以下是 Three.js r164 版本中 `OBJExporter.js` 的源代码。

```javascript
import {
	Color,
	Matrix3,
	Vector2,
	Vector3
} from 'three';

class OBJExporter {

	parse( object ) {

		let output = '';

		let indexVertex = 0;
		let indexVertexUvs = 0;
		let indexNormals = 0;

		const vertex = new Vector3();
		const color = new Color();
		const normal = new Vector3();
		const uv = new Vector2();

		const face = [];

		function parseMesh( mesh ) {

			let nbVertex = 0;
			let nbNormals = 0;
			let nbVertexUvs = 0;

			const geometry = mesh.geometry;

			const normalMatrixWorld = new Matrix3();

			// shortcuts
			const vertices = geometry.getAttribute( 'position' );
			const normals = geometry.getAttribute( 'normal' );
			const uvs = geometry.getAttribute( 'uv' );
			const indices = geometry.getIndex();

			// name of the mesh object
			output += 'o ' + mesh.name + '\n';

			// name of the mesh material
			if ( mesh.material && mesh.material.name ) {

				output += 'usemtl ' + mesh.material.name + '\n';

			}

			// vertices

			if ( vertices !== undefined ) {

				for ( let i = 0, l = vertices.count; i < l; i ++, nbVertex ++ ) {

					vertex.fromBufferAttribute( vertices, i );

					// transform the vertex to world space
					vertex.applyMatrix4( mesh.matrixWorld );

					// transform the vertex to export format
					output += 'v ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z + '\n';

				}

			}

			// uvs

			if ( uvs !== undefined ) {

				for ( let i = 0, l = uvs.count; i < l; i ++, nbVertexUvs ++ ) {

					uv.fromBufferAttribute( uvs, i );

					// transform the uv to export format
					output += 'vt ' + uv.x + ' ' + uv.y + '\n';

				}

			}

			// normals

			if ( normals !== undefined ) {

				normalMatrixWorld.getNormalMatrix( mesh.matrixWorld );

				for ( let i = 0, l = normals.count; i < l; i ++, nbNormals ++ ) {

					normal.fromBufferAttribute( normals, i );

					// transform the normal to world space
					normal.applyMatrix3( normalMatrixWorld ).normalize();

					// transform the normal to export format
					output += 'vn ' + normal.x + ' ' + normal.y + ' ' + normal.z + '\n';

				}

			}

			// faces

			if ( indices !== null ) {

				for ( let i = 0, l = indices.count; i < l; i += 3 ) {

					for ( let m = 0; m < 3; m ++ ) {

						const j = indices.getX( i + m ) + 1;

						face[ m ] = ( indexVertex + j ) + ( normals || uvs ? '/' + ( uvs ? ( indexVertexUvs + j ) : '' ) + ( normals ? '/' + ( indexNormals + j ) : '' ) : '' );

					}

					// transform the face to export format
					output += 'f ' + face.join( ' ' ) + '\n';

				}

			} else {

				for ( let i = 0, l = vertices.count; i < l; i += 3 ) {

					for ( let m = 0; m < 3; m ++ ) {

						const j = i + m + 1;

						face[ m ] = ( indexVertex + j ) + ( normals || uvs ? '/' + ( uvs ? ( indexVertexUvs + j ) : '' ) + ( normals ? '/' + ( indexNormals + j ) : '' ) : '' );

					}

					// transform the face to export format
					output += 'f ' + face.join( ' ' ) + '\n';

				}

			}

			// update index
			indexVertex += nbVertex;
			indexVertexUvs += nbVertexUvs;
			indexNormals += nbNormals;

		}

		function parseLine( line ) {

			let nbVertex = 0;

			const geometry = line.geometry;
			const type = line.type;

			// shortcuts
			const vertices = geometry.getAttribute( 'position' );

			// name of the line object
			output += 'o ' + line.name + '\n';

			if ( vertices !== undefined ) {

				for ( let i = 0, l = vertices.count; i < l; i ++, nbVertex ++ ) {

					vertex.fromBufferAttribute( vertices, i );

					// transform the vertex to world space
					vertex.applyMatrix4( line.matrixWorld );

					// transform the vertex to export format
					output += 'v ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z + '\n';

				}

			}

			if ( type === 'Line' ) {

				output += 'l ';

				for ( let j = 1, l = vertices.count; j <= l; j ++ ) {

					output += ( indexVertex + j ) + ' ';

				}

				output += '\n';

			}

			if ( type === 'LineSegments' ) {

				for ( let j = 1, k = j + 1, l = vertices.count; j < l; j += 2, k = j + 1 ) {

					output += 'l ' + ( indexVertex + j ) + ' ' + ( indexVertex + k ) + '\n';

				}

			}

			// update index
			indexVertex += nbVertex;

		}

		function parsePoints( points ) {

			let nbVertex = 0;

			const geometry = points.geometry;

			const vertices = geometry.getAttribute( 'position' );
			const colors = geometry.getAttribute( 'color' );

			output += 'o ' + points.name + '\n';

			if ( vertices !== undefined ) {

				for ( let i = 0, l = vertices.count; i < l; i ++, nbVertex ++ ) {

					vertex.fromBufferAttribute( vertices, i );
					vertex.applyMatrix4( points.matrixWorld );

					output += 'v ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z;

					if ( colors !== undefined ) {

						color.fromBufferAttribute( colors, i ).convertLinearToSRGB();

						output += ' ' + color.r + ' ' + color.g + ' ' + color.b;

					}

					output += '\n';

				}

				output += 'p ';

				for ( let j = 1, l = vertices.count; j <= l; j ++ ) {

					output += ( indexVertex + j ) + ' ';

				}

				output += '\n';

			}

			// update index
			indexVertex += nbVertex;

		}

		object.traverse( function ( child ) {

			if ( child.isMesh === true ) {

				parseMesh( child );

			}

			if ( child.isLine === true ) {

				parseLine( child );

			}

			if ( child.isPoints === true ) {

				parsePoints( child );

			}

		} );

		return output;

	}

}

export { OBJExporter };
```

## 2. 限制分析

基于源代码，以下是 `OBJExporter` 的主要限制：

1.  **主要仅包含几何体**：它主要导出几何数据：
    *   顶点 (`v`)
    *   法线 (`vn`)
    *   纹理坐标 (`vt`)
    *   面 (`f`)
    *   线 (`l`)
    *   点 (`p`)
2.  **无材质定义**：它**不**导出材质属性（颜色、纹理、高光等）。它仅使用 `usemtl` 引用材质名称。
3.  **无 `mtllib`**：它不会写入 `mtllib` 语句来链接外部 `.mtl` 文件。
4.  **世界坐标转换**：所有顶点和法线都被烘焙到世界空间中 (`applyMatrix4( mesh.matrixWorld )`)。这意味着场景层级结构在输出的几何体中被扁平化了。
5.  **支持的对象**：它仅显式处理 `Mesh`（网格）、`Line`（线）和 `Points`（点）。其他对象类型（如 `SkinnedMesh` 会被当作普通 `Mesh` 处理但没有蒙皮数据，`Camera`、`Light` 等）会被忽略，除非它们通过了 `isMesh` 检查。
6.  **无动画**：不支持动画导出。

## 3. MTL 导出能力

**它能使用/导出 MTL 吗？**

*   **不能，它无法导出 `.mtl` 文件。**
*   `OBJExporter` 类没有生成 `.mtl` 文件内容的逻辑。
*   它**确实**会在 `.obj` 输出中写入 `usemtl [material.name]` 行，告诉 OBJ 加载器去查找哪个材质名称。
*   然而，如果没有对应的 `.mtl` 文件（以及 `.obj` 中的 `mtllib` 引用），这些 `usemtl` 指令对于大多数外部查看器来说实际上是无用的，除非你手动创建 `.mtl` 文件并添加 `mtllib` 行。

**结论**：要导出带有材质的 OBJ，你需要一个单独的 `MTLExporter`。但是，**Three.js 官方并没有提供 `MTLExporter`**。

**建议**：
如果你需要导出材质、纹理和场景层级，强烈建议改用 **`GLTFExporter`**。它是 3D Web 交换的现代标准，完全支持材质、PBR 和场景图。
