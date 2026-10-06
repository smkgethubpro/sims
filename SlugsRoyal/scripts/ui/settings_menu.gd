extends Control
class_name SettingsMenu
## SettingsMenu - Settings menu for Slugs Royal

# Export variables
@export var graphics_slider: Slider
@export var sound_slider: Slider
@export var music_slider: Slider
@export var sensitivity_slider: Slider
@export var invert_y_check: CheckButton
@export var fps_limit_input: SpinBox
@export var close_button: Button

# Settings data
var settings: Dictionary = {}

func _ready() -> void:
	# Load settings
	settings = SaveSystem.load_settings()
	
	# Apply settings to UI
	_apply_settings_to_ui()
	
	# Connect signals
	if close_button:
		close_button.pressed.connect(hide)

func _apply_settings_to_ui() -> void:
	# Graphics quality
	if graphics_slider:
		graphics_slider.value = _get_graphics_index(settings.get("graphics_quality", "medium"))
		graphics_slider.value_changed.connect(_on_graphics_changed)
	
	# Sound volume
	if sound_slider:
		sound_slider.value = settings.get("sound_volume", 1.0) * 100.0
		sound_slider.value_changed.connect(_on_sound_volume_changed)
	
	# Music volume
	if music_slider:
		music_slider.value = settings.get("music_volume", 0.8) * 100.0
		music_slider.value_changed.connect(_on_music_volume_changed)
	
	# Sensitivity
	if sensitivity_slider:
		sensitivity_slider.value = settings.get("sensitivity", 1.0) * 100.0
		sensitivity_slider.value_changed.connect(_on_sensitivity_changed)
	
	# Invert Y
	if invert_y_check:
		invert_y_check.button_pressed = settings.get("invert_y", false)
		invert_y_check.toggled.connect(_on_invert_y_changed)
	
	# FPS limit
	if fps_limit_input:
		fps_limit_input.value = settings.get("fps_limit", 60)
		fps_limit_input.value_changed.connect(_on_fps_limit_changed)

func _get_graphics_index(quality: String) -> float:
	match quality:
		"low":
			return 0
		"medium":
			return 1
		"high":
			return 2
		"ultra":
			return 3
		_: 
			return 1

func _get_graphics_quality(index: float) -> String:
	var qualities = ["low", "medium", "high", "ultra"]
	return qualities[int(index)]

func _on_graphics_changed(value: float) -> void:
	settings["graphics_quality"] = _get_graphics_quality(value)
	SaveSystem.save_settings(settings)
	
	# Apply graphics settings
	_apply_graphics_settings()

func _on_sound_volume_changed(value: float) -> void:
	settings["sound_volume"] = value / 100.0
	SaveSystem.save_settings(settings)
	
	# Update audio manager
	if AudioManager:
		AudioManager.set_sfx_volume(value / 100.0)

func _on_music_volume_changed(value: float) -> void:
	settings["music_volume"] = value / 100.0
	SaveSystem.save_settings(settings)
	
	# Update audio manager
	if AudioManager:
		AudioManager.set_music_volume(value / 100.0)

func _on_sensitivity_changed(value: float) -> void:
	settings["sensitivity"] = value / 100.0
	SaveSystem.save_settings(settings)

func _on_invert_y_changed(button_pressed: bool) -> void:
	settings["invert_y"] = button_pressed
	SaveSystem.save_settings(settings)

func _on_fps_limit_changed(value: float) -> void:
	settings["fps_limit"] = int(value)
	SaveSystem.save_settings(settings)
	
	# Apply FPS limit
	Engine.max_fps = int(value)

func _apply_graphics_settings() -> void:
	# Apply graphics settings based on quality
	var quality = settings.get("graphics_quality", "medium")
	
	match quality:
		"low":
			# Low graphics settings
			RenderingServer.set_shading_quality(RenderingServer.SHADING_QUALITY_LOW)
			RenderingServer.set_shadow_quality(RenderingServer.SHADOW_QUALITY_LOW)
			RenderingServer.set_reflection_quality(RenderingServer.REFLECTION_QUALITY_LOW)
			RenderingServer.set_volumetric_fog_quality(RenderingServer.VOLUMETRIC_FOG_QUALITY_LOW)
			
			# Reduce draw distances
			RenderingServer.set_max_visible_instances(500)
			
			# Disable some effects
			RenderingServer.set_ssao_enabled(false)
			RenderingServer.set_ssr_enabled(false)
			RenderingServer.set_volumetric_fog_enabled(false)
		"medium":
			# Medium graphics settings (default)
			RenderingServer.set_shading_quality(RenderingServer.SHADING_QUALITY_MEDIUM)
			RenderingServer.set_shadow_quality(RenderingServer.SHADOW_QUALITY_MEDIUM)
			RenderingServer.set_reflection_quality(RenderingServer.REFLECTION_QUALITY_MEDIUM)
			RenderingServer.set_volumetric_fog_quality(RenderingServer.VOLUMETRIC_FOG_QUALITY_MEDIUM)
			
			RenderingServer.set_max_visible_instances(1000)
			
			RenderingServer.set_ssao_enabled(true)
			RenderingServer.set_ssr_enabled(false)
			RenderingServer.set_volumetric_fog_enabled(true)
		"high":
			# High graphics settings
			RenderingServer.set_shading_quality(RenderingServer.SHADING_QUALITY_HIGH)
			RenderingServer.set_shadow_quality(RenderingServer.SHADOW_QUALITY_HIGH)
			RenderingServer.set_reflection_quality(RenderingServer.REFLECTION_QUALITY_HIGH)
			RenderingServer.set_volumetric_fog_quality(RenderingServer.VOLUMETRIC_FOG_QUALITY_HIGH)
			
			RenderingServer.set_max_visible_instances(2000)
			
			RenderingServer.set_ssao_enabled(true)
			RenderingServer.set_ssr_enabled(true)
			RenderingServer.set_volumetric_fog_enabled(true)
		"ultra":
			# Ultra graphics settings
			RenderingServer.set_shading_quality(RenderingServer.SHADING_QUALITY_ULTRA)
			RenderingServer.set_shadow_quality(RenderingServer.SHADOW_QUALITY_ULTRA)
			RenderingServer.set_reflection_quality(RenderingServer.REFLECTION_QUALITY_ULTRA)
			RenderingServer.set_volumetric_fog_quality(RenderingServer.VOLUMETRIC_FOG_QUALITY_ULTRA)
			
			RenderingServer.set_max_visible_instances(4000)
			
			RenderingServer.set_ssao_enabled(true)
			RenderingServer.set_ssr_enabled(true)
			RenderingServer.set_volumetric_fog_enabled(true)

func show() -> void:
	visible = true
	get_tree().paused = true

func hide() -> void:
	visible = false
	get_tree().paused = false
