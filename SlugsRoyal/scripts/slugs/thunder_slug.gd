extends SlugResource
class_name ThunderSlug

## ThunderSlug - Electric slug with chain damage

func _init():
	super()
	slug_name = "Thunder"
	description = "Lightning projectile that chains to nearby enemies"
	color = Color.YELLOW
	damage = 20.0
	projectile_speed = 30.0
	cooldown = 1.8
	area_radius = 4.0
	duration = 0.5
	slug_type = 2  # Electric

# Chain properties
@export var chain_distance: float = 5.0
@export var chain_count: int = 3
@export var chain_damage_multiplier: float = 0.7

func activate(firer: Node3D, weapon: Node3D) -> void:
	# Fire lightning projectile
	fire_projectile(firer, weapon)

func apply_effect(target: Node3D, hit_position: Vector3) -> void:
	# Apply initial damage
	super.apply_effect(target, hit_position)
	
	# Chain to nearby enemies
	if chain_count > 0:
		_chain_lightning(target, hit_position, chain_count, damage * chain_damage_multiplier)

func _chain_lightning(previous_target: Node3D, position: Vector3, remaining_chains: int, chain_damage: float) -> void:
	if remaining_chains <= 0:
		return
	
	# Find nearest enemy within chain distance
	var space_state = previous_target.get_world_3d().direct_space_state
	var query = PhysicsRayQueryParameters3D.new()
	
	# Check all directions for nearby enemies
	var nearest_target = null
	var nearest_distance = chain_distance + 1.0
	
	# Get all bodies in range
	var bodies = []
	var sphere_query = PhysicsSphereQueryParameters3D.new()
	sphere_query.position = position
	sphere_query.radius = chain_distance
	sphere_query.collide_with_areas = false
	sphere_query.collide_with_bodies = true
	sphere_query.exclude = [previous_target]
	
	var result = space_state.intersect_sphere(sphere_query)
	for rid in result:
		var body = space_state.get_rid_data(rid)
		if body and (body.is_in_group("enemies") or body.is_in_group("players")):
			var distance = position.distance_to(body.global_position)
			if distance < nearest_distance and body != previous_target:
				nearest_distance = distance
				nearest_target = body
	
	if nearest_target:
		# Create chain effect
		_create_chain_effect(position, nearest_target.global_position)
		
		# Apply damage to chained target
		if nearest_target.has_method("take_damage"):
			nearest_target.take_damage(chain_damage)
		
		# Continue chaining
		_chain_lightning(nearest_target, nearest_target.global_position, remaining_chains - 1, chain_damage * chain_damage_multiplier)

func _create_chain_effect(from: Vector3, to: Vector3) -> void:
	# Create a lightning bolt effect between points
	var curve = Curve3D.new()
	curve.add_point(from)
	curve.add_point((from + to) * 0.5 + Vector3(randf_range(-0.5, 0.5), randf_range(-0.5, 0.5), randf_range(-0.5, 0.5)))
	curve.add_point(to)
	
	var path = Path3D.new()
	path.curve = curve
	
	# Create a mesh for the lightning
	var mesh_instance = MeshInstance3D.new()
	path.add_child(mesh_instance)
	
	# Create a simple lightning mesh
	var array_mesh = ArrayMesh.new()
	var surface_tool = SurfaceTool.new()
	surface_tool.create_from(path, 0.1)
	surface_tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	
	# This is a simplified version - in practice you'd want a proper lightning shader
	var material = StandardMaterial3D.new()
	material.albedo_color = Color.YELLOW
	material.emission_color = Color.YELLOW * 2.0
	material.emission_enabled = true
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.albedo_alpha = 0.8
	
	mesh_instance.material_override = material
	mesh_instance.mesh = array_mesh
	
	# Add to scene
	var root = get_tree().root
	root.add_child(path)
	
	# Remove after short duration
	var timer = Timer.new()
	path.add_child(timer)
	timer.timeout.connect(path.queue_free)
	timer.start(0.3)
