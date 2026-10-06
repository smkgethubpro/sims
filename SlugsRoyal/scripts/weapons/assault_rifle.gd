extends Weapon
class_name AssaultRifle

## AssaultRifle - Automatic assault rifle

func _init():
	super()
	weapon_name = "Assault Rifle"
	weapon_type = "Rifle"
	damage = 8.0
	fire_rate = 0.1
	max_ammo = 30
	reload_time = 2.0
	projectile_speed = 30.0
	spread = 0.03
