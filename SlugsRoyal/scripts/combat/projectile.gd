extends RigidBody3D
class_name Projectile

## Projectile - Base projectile class for weapons and slugs

# Signals
signal hit(target: Node3D, position: Vector3)
signal destroyed

# Export variables
@export var damage: float = 10.0
@export var speed: float = 20.0
@export var lifetime: float = 5.0
@export var gravity_multiplier: float = 0.0

# Current state
var direction: Vector3 = Vector3.FORWARD
var owner: Node3D
var time_alive: float = 0.0

# References
@onready var hitbox: Area3D = $Hitbox

func _ready() -> void:
	# Set up hitbox
	if hitbox:
		hitbox.body_entered.connect(_on_body_entered)
	
	# Start lifetime timer
	var timer = Timer.new()
	add_child(timer)
	timer.timeout.connect(queue_free)
	timer.start(lifetime)
	
	# Set physics properties
	mass = 0.1
	linear_damping = 0.0
	angular_damping = 0.0
	
	# Apply initial velocity
	linear_velocity = direction * speed

func _physics_process(delta: float) -> void:
	time_alive += delta
	
	# Apply gravity if needed
	if gravity_multiplier > 0:
		var gravity = ProjectSettings.get_setting("physics/3d/default_gravity")
		apply_central_impulse(direction * gravity * gravity_multiplier * delta)
	
	# Ensure projectile faces direction of travel
	if linear_velocity.length() > 0.1:
		global_transform.looking_at(global_position + linear_velocity.normalized(), Vector3.UP)

func _on_body_entered(body: Node3D) -> void:
	# Ignore owner
	if body == owner:
		return
	
	# Apply damage
	if body.has_method("take_damage"):
		body.take_damage(damage)
	
	# Emit hit signal
	hit.emit(body, global_position)
	
	# Create impact effect
	_on_hit(body, global_position)
	
	# Destroy projectile
	queue_free()

func _on_hit(target: Node3D, position: Vector3) -> void:
	# Override in child classes for custom hit effects
	pass

func set_direction(new_direction: Vector3) -> void:
	direction = new_direction.normalized()
	linear_velocity = direction * speed

func set_damage(new_damage: float) -> void:
	damage = new_damage

func set_speed(new_speed: float) -> void:
	speed = new_speed
	if linear_velocity.length() > 0:
		linear_velocity = linear_velocity.normalized() * speed

func set_owner(new_owner: Node3D) -> void:
	owner = new_owner

func get_owner() -> Node3D:
	return owner

func get_damage() -> float:
	return damage
