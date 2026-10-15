{
	"patcher": {
		"fileversion": 1,
		"appversion": {
			"major": 9,
			"minor": 0,
			"revision": 0,
			"architecture": "x64",
			"modernui": 1
		},
		"classnamespace": "box",
		"rect": [
			50,
			80,
			1500,
			900
		],
		"openinpresentation": 1,
		"default_fontsize": 10,
		"default_fontface": 0,
		"default_fontname": "Arial",
		"gridonopen": 1,
		"gridsize": [
			8,
			8
		],
		"gridsnaponopen": 1,
		"objectsnaponopen": 1,
		"enablehscroll": 1,
		"enablevscroll": 1,
		"devicewidth": 1870,
		"description": "SliceKit - slices from many samples on the MIDI keyboard",
		"digest": "",
		"tags": "",
		"boxes": [
			{
				"box": {
					"id": "obj-1",
					"maxclass": "newobj",
					"text": "v8 slicekit.js ---src ---skstate ---skview",
					"numinlets": 1,
					"numoutlets": 4,
					"outlettype": [
						"",
						"",
						"",
						""
					],
					"patching_rect": [
						400,
						1551,
						380,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-2",
					"maxclass": "comment",
					"text": "INPUTS  (everything below feeds inlet 0 of the glue)",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						20,
						14,
						340,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-3",
					"maxclass": "newobj",
					"text": "live.thisdevice",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"bang",
						"int",
						"int"
					],
					"patching_rect": [
						20,
						44,
						120,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-4",
					"maxclass": "message",
					"text": "init",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						20,
						78,
						40,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-5",
					"maxclass": "comment",
					"text": "MIDI",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						20,
						116,
						60,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-6",
					"maxclass": "newobj",
					"text": "midiin",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"int"
					],
					"patching_rect": [
						20,
						138,
						56,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-7",
					"maxclass": "newobj",
					"text": "midiparse",
					"numinlets": 1,
					"numoutlets": 7,
					"outlettype": [
						"",
						"",
						"",
						"",
						"",
						"",
						""
					],
					"patching_rect": [
						20,
						168,
						250,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-8",
					"maxclass": "newobj",
					"text": "prepend note",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						20,
						204,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-9",
					"maxclass": "newobj",
					"text": "prepend polypressure",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						112,
						204,
						134,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-10",
					"maxclass": "newobj",
					"text": "prepend pressure",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						252,
						204,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-11",
					"maxclass": "comment",
					"text": "DROP / LOAD",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						20,
						252,
						120,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-12",
					"maxclass": "live.drop",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 0,
					"patching_rect": [
						20,
						274,
						80,
						40
					],
					"presentation": 1,
					"presentation_rect": [
						4,
						19,
						80,
						88
					],
					"varname": "sk_drop"
				}
			},
			{
				"box": {
					"id": "obj-13",
					"maxclass": "newobj",
					"text": "prepend drop",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						20,
						328,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-14",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						20,
						372,
						80,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						4,
						111,
						80,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Load Sample",
							"parameter_shortname": "Load",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_load",
					"mode": 0,
					"text": "Load",
					"texton": "Load",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-15",
					"maxclass": "newobj",
					"text": "opendialog sound",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"bang"
					],
					"patching_rect": [
						20,
						404,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-16",
					"maxclass": "newobj",
					"text": "prepend load",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						20,
						440,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-17",
					"maxclass": "comment",
					"text": "SAMPLE  - source <param>   (feedback src_* -> prepend set)",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						400,
						50,
						640,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-18",
					"maxclass": "newobj",
					"text": "route src_playmode src_trigmode src_slicemode src_sensitivity src_beatdiv src_regions src_bpm src_minslice src_snap",
					"numinlets": 1,
					"numoutlets": 10,
					"outlettype": [
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						""
					],
					"patching_rect": [
						400,
						76,
						1216,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-19",
					"maxclass": "live.tab",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						154,
						108,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						700,
						22,
						108,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Sample Play Mode",
							"parameter_shortname": "Play",
							"parameter_type": 2,
							"parameter_enum": [
								"Mono",
								"Poly",
								"Thru"
							],
							"parameter_mmax": 2,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_playmode",
					"num_lines_patching": 1,
					"num_lines_presentation": 1,
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-20",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						124,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-21",
					"maxclass": "newobj",
					"text": "prepend source playmode",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						182,
						152,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-22",
					"maxclass": "live.tab",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						154,
						72,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						812,
						22,
						72,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Sample Trig Mode",
							"parameter_shortname": "Trig",
							"parameter_type": 2,
							"parameter_enum": [
								"Trig",
								"Gate"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_trigmode",
					"num_lines_patching": 1,
					"num_lines_presentation": 1,
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-23",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						124,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-24",
					"maxclass": "newobj",
					"text": "prepend source trigmode",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						182,
						152,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-25",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						154,
						78,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						700,
						77,
						78,
						17
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Slice Mode",
							"parameter_shortname": "Slice",
							"parameter_type": 2,
							"parameter_enum": [
								"Transient",
								"Beat",
								"Region",
								"Manual"
							],
							"parameter_mmax": 3,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_slicemode",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-26",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						124,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-27",
					"maxclass": "newobj",
					"text": "prepend source slicemode",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						181,
						158,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-28",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						154,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						892,
						22,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Slice Sensitivity",
							"parameter_shortname": "Sens",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_sens"
				}
			},
			{
				"box": {
					"id": "obj-29",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						124,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-30",
					"maxclass": "newobj",
					"text": "prepend source sensitivity",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						212,
						170,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-31",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						154,
						58,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						782,
						77,
						58,
						17
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Slice Beat Division",
							"parameter_shortname": "Beat Div",
							"parameter_type": 2,
							"parameter_enum": [
								"1/16",
								"1/16T",
								"1/8",
								"1/8T",
								"1/4",
								"1/4T",
								"1/2",
								"1/2T",
								"1 Bar",
								"2 Bars",
								"4 Bars"
							],
							"parameter_mmax": 10,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_beatdiv",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-32",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						124,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-33",
					"maxclass": "newobj",
					"text": "prepend source beatdiv",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						181,
						146,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-34",
					"maxclass": "live.numbox",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1280,
						154,
						40,
						15
					],
					"presentation": 1,
					"presentation_rect": [
						844,
						77,
						40,
						15
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Slice Regions",
							"parameter_shortname": "Regions",
							"parameter_type": 1,
							"parameter_mmin": 2,
							"parameter_mmax": 128,
							"parameter_unitstyle": 0,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_regions",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-35",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						124,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-36",
					"maxclass": "newobj",
					"text": "prepend source regions",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						179,
						146,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-37",
					"maxclass": "live.numbox",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1456,
						154,
						40,
						15
					],
					"presentation": 1,
					"presentation_rect": [
						700,
						119,
						40,
						15
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Slice BPM",
							"parameter_shortname": "BPM",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 250,
							"parameter_unitstyle": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_bpm",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-38",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						124,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-39",
					"maxclass": "newobj",
					"text": "prepend source bpm",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						179,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-40",
					"maxclass": "live.numbox",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						284,
						40,
						15
					],
					"presentation": 1,
					"presentation_rect": [
						744,
						119,
						40,
						15
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Slice Min Length",
							"parameter_shortname": "Min Slice",
							"parameter_type": 1,
							"parameter_mmin": 5,
							"parameter_mmax": 500,
							"parameter_unitstyle": 2,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_minslice",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-41",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						254,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-42",
					"maxclass": "newobj",
					"text": "prepend source minslice",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						309,
						152,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-43",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						284,
						44,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						788,
						118,
						44,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Slice Snap",
							"parameter_shortname": "Snap",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_snap",
					"mode": 1,
					"text": "Snap",
					"texton": "Snap",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-44",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						254,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-45",
					"maxclass": "newobj",
					"text": "prepend source snap",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						310,
						128,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-46",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						284,
						56,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						836,
						118,
						56,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Slice Reslice",
							"parameter_shortname": "Reslice",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_reslice",
					"mode": 0,
					"text": "Reslice",
					"texton": "Reslice",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-47",
					"maxclass": "message",
					"text": "source reslice",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						310,
						98,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-48",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						284,
						80,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						4,
						133,
						80,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Sample Remove",
							"parameter_shortname": "Remove",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_src_remove",
					"mode": 0,
					"text": "Remove",
					"texton": "Remove",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-49",
					"maxclass": "message",
					"text": "source remove",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						312,
						92,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-50",
					"maxclass": "comment",
					"text": "PAD  - pad <param>   (feedback pad_* -> prepend set)",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						400,
						378,
						640,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-51",
					"maxclass": "newobj",
					"text": "route pad_reverse pad_pitch pad_fine pad_gain pad_attack pad_decay pad_sustain pad_release pad_start pad_loop pad_loopsize pad_looppos pad_cutoff pad_drive pad_lock pad_layerarm pad_duparm pad_spreadparam pad_spreadcount pad_spreadstep",
					"numinlets": 1,
					"numoutlets": 21,
					"outlettype": [
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						""
					],
					"patching_rect": [
						400,
						404,
						1216,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-52",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						482,
						46,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						948,
						122,
						46,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Reverse",
							"parameter_shortname": "Rev",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_reverse",
					"mode": 1,
					"text": "Rev",
					"texton": "Rev",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-53",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						452,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-54",
					"maxclass": "newobj",
					"text": "prepend pad reverse",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						508,
						128,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-55",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						482,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						948,
						18,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Pitch",
							"parameter_shortname": "Pitch",
							"parameter_type": 1,
							"parameter_mmin": -48,
							"parameter_mmax": 48,
							"parameter_unitstyle": 7,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_pitch"
				}
			},
			{
				"box": {
					"id": "obj-56",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						452,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-57",
					"maxclass": "newobj",
					"text": "prepend pad pitch",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						540,
						116,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-58",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						482,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						991,
						18,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Fine",
							"parameter_shortname": "Fine",
							"parameter_type": 1,
							"parameter_mmin": -100,
							"parameter_mmax": 100,
							"parameter_unitstyle": 9,
							"parameter_units": "ct",
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_fine"
				}
			},
			{
				"box": {
					"id": "obj-59",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						452,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-60",
					"maxclass": "newobj",
					"text": "prepend pad fine",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						540,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-61",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						482,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1034,
						18,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Gain",
							"parameter_shortname": "Gain",
							"parameter_type": 0,
							"parameter_mmin": -60,
							"parameter_mmax": 12,
							"parameter_unitstyle": 4,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_gain"
				}
			},
			{
				"box": {
					"id": "obj-62",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						452,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-63",
					"maxclass": "newobj",
					"text": "prepend pad gain",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						540,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-64",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						482,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1120,
						18,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Attack",
							"parameter_shortname": "Atk",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 2000,
							"parameter_unitstyle": 2,
							"parameter_exponent": 3,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_attack"
				}
			},
			{
				"box": {
					"id": "obj-65",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						452,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-66",
					"maxclass": "newobj",
					"text": "prepend pad attack",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						540,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-67",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1280,
						482,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1163,
						18,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Decay",
							"parameter_shortname": "Dec",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 5000,
							"parameter_unitstyle": 2,
							"parameter_exponent": 3,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_decay"
				}
			},
			{
				"box": {
					"id": "obj-68",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						452,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-69",
					"maxclass": "newobj",
					"text": "prepend pad decay",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						540,
						116,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-70",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1456,
						482,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1206,
						18,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Sustain",
							"parameter_shortname": "Sus",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_sustain"
				}
			},
			{
				"box": {
					"id": "obj-71",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						452,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-72",
					"maxclass": "newobj",
					"text": "prepend pad sustain",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						540,
						128,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-73",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						612,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1249,
						18,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Release",
							"parameter_shortname": "Rel",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 5000,
							"parameter_unitstyle": 2,
							"parameter_exponent": 3,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_release"
				}
			},
			{
				"box": {
					"id": "obj-74",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						582,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-75",
					"maxclass": "newobj",
					"text": "prepend pad release",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						670,
						128,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-76",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						612,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1077,
						18,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Start",
							"parameter_shortname": "Start",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 1000,
							"parameter_unitstyle": 2,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_start"
				}
			},
			{
				"box": {
					"id": "obj-77",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						582,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-78",
					"maxclass": "newobj",
					"text": "prepend pad start",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						670,
						116,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-79",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						612,
						46,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						996,
						122,
						46,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Loop",
							"parameter_shortname": "Loop",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_loop",
					"mode": 1,
					"text": "Loop",
					"texton": "Loop",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-80",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						582,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-81",
					"maxclass": "newobj",
					"text": "prepend pad loop",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						638,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-82",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						612,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						948,
						68,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Loop Size",
							"parameter_shortname": "LpSize",
							"parameter_type": 0,
							"parameter_mmin": 1,
							"parameter_mmax": 500,
							"parameter_unitstyle": 2,
							"parameter_exponent": 3,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_loopsize"
				}
			},
			{
				"box": {
					"id": "obj-83",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						582,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-84",
					"maxclass": "newobj",
					"text": "prepend pad loopsize",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						670,
						134,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-85",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						612,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						991,
						68,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Loop Pos",
							"parameter_shortname": "LpPos",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_looppos"
				}
			},
			{
				"box": {
					"id": "obj-86",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						582,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-87",
					"maxclass": "newobj",
					"text": "prepend pad looppos",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						670,
						128,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-88",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1280,
						612,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1034,
						68,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Cutoff",
							"parameter_shortname": "Cutoff",
							"parameter_type": 0,
							"parameter_mmin": 20,
							"parameter_mmax": 20000,
							"parameter_unitstyle": 3,
							"parameter_exponent": 3,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_cutoff"
				}
			},
			{
				"box": {
					"id": "obj-89",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						582,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-90",
					"maxclass": "newobj",
					"text": "prepend pad cutoff",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						670,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-91",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1456,
						612,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1077,
						68,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Drive",
							"parameter_shortname": "Drive",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_drive"
				}
			},
			{
				"box": {
					"id": "obj-92",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						582,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-93",
					"maxclass": "newobj",
					"text": "prepend pad drive",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						670,
						116,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-94",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						742,
						46,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1044,
						122,
						46,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Lock",
							"parameter_shortname": "Lock",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_lock",
					"mode": 1,
					"text": "Lock",
					"texton": "Lock",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-95",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						712,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-96",
					"maxclass": "newobj",
					"text": "prepend pad lock",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						768,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-97",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						742,
						46,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						948,
						142,
						46,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Similar Prev",
							"parameter_shortname": "‹ Sim",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_simprev",
					"mode": 0,
					"text": "‹ Sim",
					"texton": "‹ Sim",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-98",
					"maxclass": "message",
					"text": "pad similar -1",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						768,
						98,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-99",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						742,
						46,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						996,
						142,
						46,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Similar Next",
							"parameter_shortname": "Sim ›",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_simnext",
					"mode": 0,
					"text": "Sim ›",
					"texton": "Sim ›",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-100",
					"maxclass": "message",
					"text": "pad similar 1",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						768,
						92,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-101",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						742,
						46,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1092,
						122,
						46,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Layer Arm",
							"parameter_shortname": "Layer",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_layer",
					"mode": 1,
					"text": "Layer",
					"texton": "Layer",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-102",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						712,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-103",
					"maxclass": "newobj",
					"text": "prepend pad layerarm",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						768,
						134,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-104",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						742,
						46,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1140,
						122,
						46,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Duplicate Arm",
							"parameter_shortname": "Dup",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_dup",
					"mode": 1,
					"text": "Dup",
					"texton": "Dup",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-105",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						712,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-106",
					"maxclass": "newobj",
					"text": "prepend pad duparm",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						768,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-107",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1280,
						742,
						54,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						1126,
						81,
						54,
						17
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Spread Param",
							"parameter_shortname": "Spread",
							"parameter_type": 2,
							"parameter_enum": [
								"Pitch",
								"Decay",
								"Start",
								"Cutoff"
							],
							"parameter_mmax": 3,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_spreadparam",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-108",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						712,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-109",
					"maxclass": "newobj",
					"text": "prepend pad spreadparam",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						769,
						152,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-110",
					"maxclass": "live.numbox",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1456,
						742,
						38,
						15
					],
					"presentation": 1,
					"presentation_rect": [
						1184,
						81,
						38,
						15
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Spread Count",
							"parameter_shortname": "Count",
							"parameter_type": 1,
							"parameter_mmin": 2,
							"parameter_mmax": 16,
							"parameter_unitstyle": 0,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_spreadcount",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-111",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						712,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-112",
					"maxclass": "newobj",
					"text": "prepend pad spreadcount",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						767,
						152,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-113",
					"maxclass": "live.numbox",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						841,
						38,
						15
					],
					"presentation": 1,
					"presentation_rect": [
						1226,
						81,
						38,
						15
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Spread Step",
							"parameter_shortname": "Step",
							"parameter_type": 0,
							"parameter_mmin": -24,
							"parameter_mmax": 24,
							"parameter_unitstyle": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_spreadstep",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-114",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						811,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-115",
					"maxclass": "newobj",
					"text": "prepend pad spreadstep",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						866,
						146,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-116",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						841,
						54,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1126,
						102,
						54,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Spread",
							"parameter_shortname": "Spread",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_spread",
					"mode": 0,
					"text": "Spread",
					"texton": "Spread",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-117",
					"maxclass": "message",
					"text": "pad spread",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						867,
						74,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-118",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						841,
						60,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1044,
						142,
						60,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Apply To Sample",
							"parameter_shortname": "→ Sample",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_apply",
					"mode": 0,
					"text": "→ Sample",
					"texton": "→ Sample",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-119",
					"maxclass": "message",
					"text": "pad applysource",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						867,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-120",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						841,
						46,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1108,
						142,
						46,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pad Clear",
							"parameter_shortname": "Clear",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pad_clear",
					"mode": 0,
					"text": "Clear",
					"texton": "Clear",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-121",
					"maxclass": "message",
					"text": "pad clear",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						867,
						68,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-122",
					"maxclass": "comment",
					"text": "PERFORM + KIT  - kit <param>   (feedback kit_* -> prepend set)",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						400,
						933,
						640,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-123",
					"maxclass": "newobj",
					"text": "route kit_slot kit_layout kit_zonealign kit_sortby kit_root kit_shufflemode kit_shufflescope kit_seed kit_flip kit_bestn kit_chokescope kit_modzone kit_modstart kit_velsens kit_pressure2level",
					"numinlets": 1,
					"numoutlets": 16,
					"outlettype": [
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						""
					],
					"patching_rect": [
						400,
						959,
						1216,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-124",
					"maxclass": "live.tab",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						1037,
						168,
						20
					],
					"presentation": 1,
					"presentation_rect": [
						1642,
						22,
						168,
						20
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Slot",
							"parameter_shortname": "Slot",
							"parameter_type": 2,
							"parameter_enum": [
								"A",
								"B",
								"C",
								"D",
								"E",
								"F",
								"G",
								"H"
							],
							"parameter_mmax": 7,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_invisible": 0
						}
					},
					"varname": "sk_slot",
					"num_lines_patching": 1,
					"num_lines_presentation": 1,
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-125",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						1007,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-126",
					"maxclass": "newobj",
					"text": "prepend kit slot",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						1067,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-127",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						1037,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1642,
						52,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Chaos",
							"parameter_shortname": "Chaos",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_invisible": 0
						}
					},
					"varname": "sk_chaos"
				}
			},
			{
				"box": {
					"id": "obj-128",
					"maxclass": "newobj",
					"text": "prepend kit chaos",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						1095,
						116,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-129",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						1037,
						72,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1738,
						52,
						72,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Repeat",
							"parameter_shortname": "Repeat",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_invisible": 0
						}
					},
					"varname": "sk_repeat",
					"mode": 1,
					"text": "Repeat",
					"texton": "Repeat",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-130",
					"maxclass": "newobj",
					"text": "prepend kit repeat",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						1065,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-131",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						1037,
						72,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						1738,
						87,
						72,
						17
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Rate",
							"parameter_shortname": "Rate",
							"parameter_type": 2,
							"parameter_enum": [
								"1/4",
								"1/8",
								"1/8T",
								"1/16",
								"1/16T",
								"1/32",
								"1/32T",
								"1/64"
							],
							"parameter_mmax": 7,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								3
							],
							"parameter_invisible": 0
						}
					},
					"varname": "sk_rate",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-132",
					"maxclass": "newobj",
					"text": "prepend kit rate",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						1064,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-133",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						1037,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1688,
						52,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Swing",
							"parameter_shortname": "Swing",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_invisible": 0
						}
					},
					"varname": "sk_swing"
				}
			},
			{
				"box": {
					"id": "obj-134",
					"maxclass": "newobj",
					"text": "prepend kit swing",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						1095,
						116,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-135",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						1280,
						1037,
						72,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1738,
						108,
						72,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Alt",
							"parameter_shortname": "Alt",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_invisible": 0
						}
					},
					"varname": "sk_alt",
					"mode": 1,
					"text": "Alt",
					"texton": "Alt",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-136",
					"maxclass": "newobj",
					"text": "prepend kit alt",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						1063,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-137",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1456,
						1037,
						80,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						1542,
						139,
						80,
						17
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Copy Slot To",
							"parameter_shortname": "Copy",
							"parameter_type": 2,
							"parameter_enum": [
								"Copy→A",
								"Copy→B",
								"Copy→C",
								"Copy→D",
								"Copy→E",
								"Copy→F",
								"Copy→G",
								"Copy→H"
							],
							"parameter_mmax": 7,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_copyslot",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-138",
					"maxclass": "newobj",
					"text": "prepend kit copyslot",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						1064,
						134,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-139",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						1167,
						70,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						1308,
						31,
						70,
						17
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kit Layout",
							"parameter_shortname": "Layout",
							"parameter_type": 2,
							"parameter_enum": [
								"Zones",
								"Interleave",
								"Sorted"
							],
							"parameter_mmax": 2,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_layout",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-140",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						1137,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-141",
					"maxclass": "newobj",
					"text": "prepend kit layout",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						1194,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-142",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						1167,
						34,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1442,
						31,
						34,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kit Zone Align",
							"parameter_shortname": "Oct",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_zonealign",
					"mode": 1,
					"text": "Oct",
					"texton": "Oct",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-143",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						1137,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-144",
					"maxclass": "newobj",
					"text": "prepend kit zonealign",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						1193,
						140,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-145",
					"maxclass": "live.menu",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						1167,
						56,
						17
					],
					"presentation": 1,
					"presentation_rect": [
						1382,
						31,
						56,
						17
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kit Sort By",
							"parameter_shortname": "Sort",
							"parameter_type": 2,
							"parameter_enum": [
								"Bright",
								"Loud",
								"Length"
							],
							"parameter_mmax": 2,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_sortby",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-146",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						1137,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-147",
					"maxclass": "newobj",
					"text": "prepend kit sortby",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						1194,
						122,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-148",
					"maxclass": "live.numbox",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						1167,
						40,
						15
					],
					"presentation": 1,
					"presentation_rect": [
						1480,
						31,
						40,
						15
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kit Root Key",
							"parameter_shortname": "Root",
							"parameter_type": 1,
							"parameter_mmin": 0,
							"parameter_mmax": 127,
							"parameter_unitstyle": 8,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_root",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-149",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						1137,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-150",
					"maxclass": "newobj",
					"text": "prepend kit root",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						1192,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-151",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						1167,
						48,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1524,
						31,
						48,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kit Relayout",
							"parameter_shortname": "Layout",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_relayout",
					"mode": 0,
					"text": "Layout",
					"texton": "Layout",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-152",
					"maxclass": "message",
					"text": "kit relayout",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						1193,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-153",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						1280,
						1167,
						52,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1308,
						64,
						52,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kit Shuffle",
							"parameter_shortname": "Shuffle",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_shuffle",
					"mode": 0,
					"text": "Shuffle",
					"texton": "Shuffle",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-154",
					"maxclass": "message",
					"text": "kit shuffle",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						1195,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-155",
					"maxclass": "live.tab",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1456,
						1167,
						66,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1364,
						64,
						66,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Shuffle Mode",
							"parameter_shortname": "Mode",
							"parameter_type": 2,
							"parameter_enum": [
								"Chaos",
								"Smart"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_shufflemode",
					"num_lines_patching": 1,
					"num_lines_presentation": 1,
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-156",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						1137,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-157",
					"maxclass": "newobj",
					"text": "prepend kit shufflemode",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						1195,
						152,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-158",
					"maxclass": "live.tab",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						1267,
						66,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1434,
						64,
						66,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Shuffle Scope",
							"parameter_shortname": "Scope",
							"parameter_type": 2,
							"parameter_enum": [
								"All",
								"Sample"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_shufflescope",
					"num_lines_patching": 1,
					"num_lines_presentation": 1,
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-159",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						1237,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-160",
					"maxclass": "newobj",
					"text": "prepend kit shufflescope",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						1295,
						158,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-161",
					"maxclass": "live.numbox",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						1267,
						40,
						15
					],
					"presentation": 1,
					"presentation_rect": [
						1504,
						66,
						40,
						15
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Shuffle Seed",
							"parameter_shortname": "Seed",
							"parameter_type": 1,
							"parameter_mmin": 0,
							"parameter_mmax": 9999,
							"parameter_unitstyle": 0,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_seed",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-162",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						1237,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-163",
					"maxclass": "newobj",
					"text": "prepend kit seed",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						1292,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-164",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						1267,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1308,
						92,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Shuffle Flip",
							"parameter_shortname": "Flip",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_flip"
				}
			},
			{
				"box": {
					"id": "obj-165",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						1237,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-166",
					"maxclass": "newobj",
					"text": "prepend kit flip",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						1325,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-167",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						1267,
						36,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1548,
						64,
						36,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kit Undo",
							"parameter_shortname": "Undo",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_undo",
					"mode": 0,
					"text": "Undo",
					"texton": "Undo",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-168",
					"maxclass": "message",
					"text": "kit undo",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						1293,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-169",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						1267,
						36,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1588,
						64,
						36,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kit Redo",
							"parameter_shortname": "Redo",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_redo",
					"mode": 0,
					"text": "Redo",
					"texton": "Redo",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-170",
					"maxclass": "message",
					"text": "kit redo",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						1293,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-171",
					"maxclass": "live.numbox",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						1280,
						1267,
						40,
						15
					],
					"presentation": 1,
					"presentation_rect": [
						1402,
						105,
						40,
						15
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Find Best N",
							"parameter_shortname": "Best N",
							"parameter_type": 1,
							"parameter_mmin": 4,
							"parameter_mmax": 64,
							"parameter_unitstyle": 0,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_bestn",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-172",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						1237,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-173",
					"maxclass": "newobj",
					"text": "prepend kit bestn",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1280,
						1292,
						116,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-174",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						1456,
						1267,
						60,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1446,
						103,
						60,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kit Find Best",
							"parameter_shortname": "Find best",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_best",
					"mode": 0,
					"text": "Find best",
					"texton": "Find best",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-175",
					"maxclass": "message",
					"text": "kit findbest",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1456,
						1295,
						86,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-176",
					"maxclass": "live.tab",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"",
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						1397,
						84,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1402,
						139,
						84,
						18
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Choke Scope",
							"parameter_shortname": "Choke",
							"parameter_type": 2,
							"parameter_enum": [
								"Sample",
								"All"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_chokescope",
					"num_lines_patching": 1,
					"num_lines_presentation": 1,
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-177",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						1367,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-178",
					"maxclass": "newobj",
					"text": "prepend kit chokescope",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						400,
						1425,
						146,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-179",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						576,
						1397,
						44,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1516,
						103,
						44,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Mod Zone",
							"parameter_shortname": "Mods",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_modzone",
					"mode": 1,
					"text": "Mods",
					"texton": "Mods",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-180",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						1367,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-181",
					"maxclass": "newobj",
					"text": "prepend kit modzone",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						576,
						1423,
						128,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-182",
					"maxclass": "live.numbox",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						752,
						1397,
						40,
						15
					],
					"presentation": 1,
					"presentation_rect": [
						1564,
						105,
						40,
						15
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Mod Zone Start",
							"parameter_shortname": "Mod Start",
							"parameter_type": 1,
							"parameter_mmin": 0,
							"parameter_mmax": 116,
							"parameter_unitstyle": 8,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_modstart",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-183",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						1367,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-184",
					"maxclass": "newobj",
					"text": "prepend kit modstart",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						752,
						1422,
						134,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-185",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						"float"
					],
					"parameter_enable": 1,
					"patching_rect": [
						928,
						1397,
						41,
						48
					],
					"presentation": 1,
					"presentation_rect": [
						1352,
						92,
						41,
						48
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Velocity Sens",
							"parameter_shortname": "Vel",
							"parameter_type": 0,
							"parameter_mmin": 0,
							"parameter_mmax": 100,
							"parameter_unitstyle": 5,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_velsens"
				}
			},
			{
				"box": {
					"id": "obj-186",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						1367,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-187",
					"maxclass": "newobj",
					"text": "prepend kit velsens",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						928,
						1455,
						128,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-188",
					"maxclass": "live.text",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						1104,
						1397,
						44,
						16
					],
					"presentation": 1,
					"presentation_rect": [
						1492,
						139,
						44,
						16
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Pressure To Level",
							"parameter_shortname": "Press",
							"parameter_type": 2,
							"parameter_enum": [
								"off",
								"on"
							],
							"parameter_mmax": 1,
							"parameter_invisible": 2
						}
					},
					"varname": "sk_pressure",
					"mode": 1,
					"text": "Press",
					"texton": "Press",
					"fontsize": 9
				}
			},
			{
				"box": {
					"id": "obj-189",
					"maxclass": "newobj",
					"text": "prepend set",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						1367,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-190",
					"maxclass": "newobj",
					"text": "prepend kit pressure2level",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1104,
						1423,
						170,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-191",
					"maxclass": "comment",
					"text": "GLUE  outlet 0 -> poly~ | 1 -> buffers | 2 -> feedback routes | 3 -> jsui",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						400,
						1525,
						520,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-192",
					"maxclass": "jsui",
					"filename": "slicekit-ui.js",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"parameter_enable": 0,
					"patching_rect": [
						820,
						1587,
						170,
						90
					],
					"presentation": 1,
					"presentation_rect": [
						90,
						3,
						600,
						160
					],
					"varname": "sk_ui"
				}
			},
			{
				"box": {
					"id": "obj-193",
					"maxclass": "newobj",
					"text": "prepend ui",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						820,
						1691,
						74,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-194",
					"maxclass": "comment",
					"text": "AUDIO",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						260,
						1605,
						60,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-195",
					"maxclass": "newobj",
					"text": "plugphasor~",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"signal"
					],
					"patching_rect": [
						260,
						1629,
						80,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-196",
					"maxclass": "newobj",
					"text": "poly~ slicekit.voice 16",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": [
						"signal",
						"signal",
						""
					],
					"patching_rect": [
						400,
						1661,
						240,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-197",
					"maxclass": "live.gain~",
					"numinlets": 2,
					"numoutlets": 5,
					"outlettype": [
						"signal",
						"signal",
						"",
						"float",
						""
					],
					"parameter_enable": 1,
					"patching_rect": [
						400,
						1727,
						48,
						100
					],
					"presentation": 1,
					"presentation_rect": [
						1824,
						4,
						40,
						161
					],
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Output",
							"parameter_shortname": "Output",
							"parameter_type": 0,
							"parameter_mmin": -70,
							"parameter_mmax": 6,
							"parameter_unitstyle": 4,
							"parameter_initial_enable": 1,
							"parameter_initial": [
								0
							],
							"parameter_invisible": 0
						}
					},
					"varname": "sk_out",
					"channels": 2
				}
			},
			{
				"box": {
					"id": "obj-198",
					"maxclass": "newobj",
					"text": "plugout~",
					"numinlets": 2,
					"numoutlets": 0,
					"patching_rect": [
						400,
						1847,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-199",
					"maxclass": "comment",
					"text": "STATE (saved with the Live Set) / VIEW MODEL (jsui)",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						470,
						1727,
						360,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-200",
					"maxclass": "newobj",
					"text": "dict ---skstate @parameter_enable 1",
					"numinlets": 2,
					"numoutlets": 4,
					"outlettype": [
						"dictionary",
						"",
						"",
						"bang"
					],
					"patching_rect": [
						470,
						1751,
						224,
						22
					],
					"parameter_enable": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "SliceKit State",
							"parameter_shortname": "State",
							"parameter_type": 3,
							"parameter_invisible": 1
						}
					},
					"varname": "sk_state"
				}
			},
			{
				"box": {
					"id": "obj-201",
					"maxclass": "newobj",
					"text": "dict ---skview",
					"numinlets": 2,
					"numoutlets": 4,
					"outlettype": [
						"dictionary",
						"",
						"",
						"bang"
					],
					"patching_rect": [
						470,
						1783,
						98,
						22
					],
					"varname": "sk_view"
				}
			},
			{
				"box": {
					"id": "obj-202",
					"maxclass": "comment",
					"text": "BUFFERS  glue outlet 1:  <i> replace <path> | <i> clear   -  right outlet of buffer~ -> loaded <i>",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						1060,
						1587,
						700,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-203",
					"maxclass": "newobj",
					"text": "route 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15",
					"numinlets": 1,
					"numoutlets": 17,
					"outlettype": [
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						"",
						""
					],
					"patching_rect": [
						1060,
						1613,
						1798,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-204",
					"maxclass": "newobj",
					"text": "buffer~ ---src0",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						1060,
						1663,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-205",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						1060,
						1703,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-206",
					"maxclass": "message",
					"text": "loaded 0",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1060,
						1739,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-207",
					"maxclass": "newobj",
					"text": "buffer~ ---src1",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						1172,
						1663,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-208",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						1172,
						1703,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-209",
					"maxclass": "message",
					"text": "loaded 1",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1172,
						1739,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-210",
					"maxclass": "newobj",
					"text": "buffer~ ---src2",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						1284,
						1663,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-211",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						1284,
						1703,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-212",
					"maxclass": "message",
					"text": "loaded 2",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1284,
						1739,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-213",
					"maxclass": "newobj",
					"text": "buffer~ ---src3",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						1396,
						1663,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-214",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						1396,
						1703,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-215",
					"maxclass": "message",
					"text": "loaded 3",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1396,
						1739,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-216",
					"maxclass": "newobj",
					"text": "buffer~ ---src4",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						1508,
						1663,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-217",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						1508,
						1703,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-218",
					"maxclass": "message",
					"text": "loaded 4",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1508,
						1739,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-219",
					"maxclass": "newobj",
					"text": "buffer~ ---src5",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						1620,
						1663,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-220",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						1620,
						1703,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-221",
					"maxclass": "message",
					"text": "loaded 5",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1620,
						1739,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-222",
					"maxclass": "newobj",
					"text": "buffer~ ---src6",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						1732,
						1663,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-223",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						1732,
						1703,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-224",
					"maxclass": "message",
					"text": "loaded 6",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1732,
						1739,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-225",
					"maxclass": "newobj",
					"text": "buffer~ ---src7",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						1844,
						1663,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-226",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						1844,
						1703,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-227",
					"maxclass": "message",
					"text": "loaded 7",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1844,
						1739,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-228",
					"maxclass": "newobj",
					"text": "buffer~ ---src8",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						1956,
						1663,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-229",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						1956,
						1703,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-230",
					"maxclass": "message",
					"text": "loaded 8",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						1956,
						1739,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-231",
					"maxclass": "newobj",
					"text": "buffer~ ---src9",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						2068,
						1663,
						104,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-232",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						2068,
						1703,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-233",
					"maxclass": "message",
					"text": "loaded 9",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						2068,
						1739,
						62,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-234",
					"maxclass": "newobj",
					"text": "buffer~ ---src10",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						2180,
						1663,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-235",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						2180,
						1703,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-236",
					"maxclass": "message",
					"text": "loaded 10",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						2180,
						1739,
						68,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-237",
					"maxclass": "newobj",
					"text": "buffer~ ---src11",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						2292,
						1663,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-238",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						2292,
						1703,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-239",
					"maxclass": "message",
					"text": "loaded 11",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						2292,
						1739,
						68,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-240",
					"maxclass": "newobj",
					"text": "buffer~ ---src12",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						2404,
						1663,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-241",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						2404,
						1703,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-242",
					"maxclass": "message",
					"text": "loaded 12",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						2404,
						1739,
						68,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-243",
					"maxclass": "newobj",
					"text": "buffer~ ---src13",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						2516,
						1663,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-244",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						2516,
						1703,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-245",
					"maxclass": "message",
					"text": "loaded 13",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						2516,
						1739,
						68,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-246",
					"maxclass": "newobj",
					"text": "buffer~ ---src14",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						2628,
						1663,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-247",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						2628,
						1703,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-248",
					"maxclass": "message",
					"text": "loaded 14",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						2628,
						1739,
						68,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-249",
					"maxclass": "newobj",
					"text": "buffer~ ---src15",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": [
						"float",
						"bang"
					],
					"patching_rect": [
						2740,
						1663,
						110,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-250",
					"maxclass": "newobj",
					"text": "t b",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [
						"bang"
					],
					"patching_rect": [
						2740,
						1703,
						32,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-251",
					"maxclass": "message",
					"text": "loaded 15",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [
						""
					],
					"patching_rect": [
						2740,
						1739,
						68,
						22
					]
				}
			},
			{
				"box": {
					"id": "obj-252",
					"maxclass": "comment",
					"text": "PRESENTATION-ONLY: panels, section titles, labels (no function)",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						2912,
						14,
						420,
						20
					]
				}
			},
			{
				"box": {
					"id": "obj-253",
					"maxclass": "panel",
					"background": 1,
					"border": 1,
					"rounded": 8,
					"mode": 0,
					"bgcolor": [
						0.5,
						0.5,
						0.5,
						0.1
					],
					"bordercolor": [
						0.5,
						0.5,
						0.5,
						0.28
					],
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						2912,
						44,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						2,
						2,
						84,
						165
					]
				}
			},
			{
				"box": {
					"id": "obj-254",
					"maxclass": "panel",
					"background": 1,
					"border": 1,
					"rounded": 8,
					"mode": 0,
					"bgcolor": [
						0.5,
						0.5,
						0.5,
						0.1
					],
					"bordercolor": [
						0.5,
						0.5,
						0.5,
						0.28
					],
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						3052,
						44,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						694,
						2,
						244,
						165
					]
				}
			},
			{
				"box": {
					"id": "obj-255",
					"maxclass": "panel",
					"background": 1,
					"border": 1,
					"rounded": 8,
					"mode": 0,
					"bgcolor": [
						0.5,
						0.5,
						0.5,
						0.1
					],
					"bordercolor": [
						0.5,
						0.5,
						0.5,
						0.28
					],
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						3192,
						44,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						942,
						2,
						356,
						165
					]
				}
			},
			{
				"box": {
					"id": "obj-256",
					"maxclass": "panel",
					"background": 1,
					"border": 1,
					"rounded": 8,
					"mode": 0,
					"bgcolor": [
						0.5,
						0.5,
						0.5,
						0.1
					],
					"bordercolor": [
						0.5,
						0.5,
						0.5,
						0.28
					],
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						2912,
						68,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1302,
						2,
						330,
						165
					]
				}
			},
			{
				"box": {
					"id": "obj-257",
					"maxclass": "panel",
					"background": 1,
					"border": 1,
					"rounded": 8,
					"mode": 0,
					"bgcolor": [
						0.5,
						0.5,
						0.5,
						0.1
					],
					"bordercolor": [
						0.5,
						0.5,
						0.5,
						0.28
					],
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						3052,
						68,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1636,
						2,
						180,
						165
					]
				}
			},
			{
				"box": {
					"id": "obj-258",
					"maxclass": "panel",
					"background": 1,
					"border": 1,
					"rounded": 8,
					"mode": 0,
					"bgcolor": [
						0.5,
						0.5,
						0.5,
						0.1
					],
					"bordercolor": [
						0.5,
						0.5,
						0.5,
						0.28
					],
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						3192,
						68,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1820,
						2,
						48,
						165
					]
				}
			},
			{
				"box": {
					"id": "obj-259",
					"maxclass": "live.comment",
					"text": "DROP SAMPLES",
					"fontsize": 10,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						2912,
						92,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						8,
						4,
						72,
						13
					]
				}
			},
			{
				"box": {
					"id": "obj-260",
					"maxclass": "live.comment",
					"text": "SAMPLE",
					"fontsize": 10,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						3052,
						92,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						700,
						4,
						232,
						13
					]
				}
			},
			{
				"box": {
					"id": "obj-261",
					"maxclass": "live.comment",
					"text": "PAD",
					"fontsize": 10,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						3192,
						92,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						948,
						4,
						344,
						13
					]
				}
			},
			{
				"box": {
					"id": "obj-262",
					"maxclass": "live.comment",
					"text": "KIT",
					"fontsize": 10,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						2912,
						116,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1308,
						4,
						318,
						13
					]
				}
			},
			{
				"box": {
					"id": "obj-263",
					"maxclass": "live.comment",
					"text": "PERFORM",
					"fontsize": 10,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						3052,
						116,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1642,
						4,
						168,
						13
					]
				}
			},
			{
				"box": {
					"id": "obj-264",
					"maxclass": "live.comment",
					"text": "Slice by",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						3192,
						116,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						700,
						64,
						78,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-265",
					"maxclass": "live.comment",
					"text": "Beat div",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						2912,
						140,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						782,
						64,
						58,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-266",
					"maxclass": "live.comment",
					"text": "Regions",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						3052,
						140,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						844,
						64,
						44,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-267",
					"maxclass": "live.comment",
					"text": "BPM",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						3192,
						140,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						700,
						106,
						40,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-268",
					"maxclass": "live.comment",
					"text": "Min ms",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						2912,
						164,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						744,
						106,
						40,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-269",
					"maxclass": "live.comment",
					"text": "Spread",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						3052,
						164,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1126,
						68,
						54,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-270",
					"maxclass": "live.comment",
					"text": "Count",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						3192,
						164,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1184,
						68,
						38,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-271",
					"maxclass": "live.comment",
					"text": "Step",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						2912,
						188,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1226,
						68,
						38,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-272",
					"maxclass": "live.comment",
					"text": "Arrange",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						3052,
						188,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1308,
						18,
						70,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-273",
					"maxclass": "live.comment",
					"text": "Sort by",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						3192,
						188,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1382,
						18,
						56,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-274",
					"maxclass": "live.comment",
					"text": "Root",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						2912,
						212,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1480,
						18,
						40,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-275",
					"maxclass": "live.comment",
					"text": "Seed",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						3052,
						212,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1504,
						50,
						40,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-276",
					"maxclass": "live.comment",
					"text": "Best N",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						3192,
						212,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1402,
						92,
						40,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-277",
					"maxclass": "live.comment",
					"text": "Mod start",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						2912,
						236,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1564,
						92,
						60,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-278",
					"maxclass": "live.comment",
					"text": "Choke",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						3052,
						236,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1402,
						126,
						50,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-279",
					"maxclass": "live.comment",
					"text": "Copy slot to",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						3192,
						236,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1542,
						126,
						80,
						12
					]
				}
			},
			{
				"box": {
					"id": "obj-280",
					"maxclass": "live.comment",
					"text": "Rate",
					"fontsize": 9,
					"textjustification": 0,
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [
						2912,
						260,
						130,
						18
					],
					"presentation": 1,
					"presentation_rect": [
						1738,
						74,
						72,
						12
					]
				}
			}
		],
		"lines": [
			{
				"patchline": {
					"source": [
						"obj-3",
						0
					],
					"destination": [
						"obj-4",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-4",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-6",
						0
					],
					"destination": [
						"obj-7",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-7",
						0
					],
					"destination": [
						"obj-8",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-7",
						1
					],
					"destination": [
						"obj-9",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-7",
						4
					],
					"destination": [
						"obj-10",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-8",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-9",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-10",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-12",
						0
					],
					"destination": [
						"obj-13",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-13",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-14",
						0
					],
					"destination": [
						"obj-15",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-15",
						0
					],
					"destination": [
						"obj-16",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-16",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-18",
						0
					],
					"destination": [
						"obj-20",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-20",
						0
					],
					"destination": [
						"obj-19",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-19",
						0
					],
					"destination": [
						"obj-21",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-21",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-18",
						1
					],
					"destination": [
						"obj-23",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-23",
						0
					],
					"destination": [
						"obj-22",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-22",
						0
					],
					"destination": [
						"obj-24",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-24",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-18",
						2
					],
					"destination": [
						"obj-26",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-26",
						0
					],
					"destination": [
						"obj-25",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-25",
						0
					],
					"destination": [
						"obj-27",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-27",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-18",
						3
					],
					"destination": [
						"obj-29",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-29",
						0
					],
					"destination": [
						"obj-28",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-28",
						0
					],
					"destination": [
						"obj-30",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-30",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-18",
						4
					],
					"destination": [
						"obj-32",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-32",
						0
					],
					"destination": [
						"obj-31",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-31",
						0
					],
					"destination": [
						"obj-33",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-33",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-18",
						5
					],
					"destination": [
						"obj-35",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-35",
						0
					],
					"destination": [
						"obj-34",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-34",
						0
					],
					"destination": [
						"obj-36",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-36",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-18",
						6
					],
					"destination": [
						"obj-38",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-38",
						0
					],
					"destination": [
						"obj-37",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-37",
						0
					],
					"destination": [
						"obj-39",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-39",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-18",
						7
					],
					"destination": [
						"obj-41",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-41",
						0
					],
					"destination": [
						"obj-40",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-40",
						0
					],
					"destination": [
						"obj-42",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-42",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-18",
						8
					],
					"destination": [
						"obj-44",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-44",
						0
					],
					"destination": [
						"obj-43",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-43",
						0
					],
					"destination": [
						"obj-45",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-45",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-46",
						0
					],
					"destination": [
						"obj-47",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-47",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-48",
						0
					],
					"destination": [
						"obj-49",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-49",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						0
					],
					"destination": [
						"obj-53",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-53",
						0
					],
					"destination": [
						"obj-52",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-52",
						0
					],
					"destination": [
						"obj-54",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-54",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						1
					],
					"destination": [
						"obj-56",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-56",
						0
					],
					"destination": [
						"obj-55",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-55",
						0
					],
					"destination": [
						"obj-57",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-57",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						2
					],
					"destination": [
						"obj-59",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-59",
						0
					],
					"destination": [
						"obj-58",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-58",
						0
					],
					"destination": [
						"obj-60",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-60",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						3
					],
					"destination": [
						"obj-62",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-62",
						0
					],
					"destination": [
						"obj-61",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-61",
						0
					],
					"destination": [
						"obj-63",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-63",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						4
					],
					"destination": [
						"obj-65",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-65",
						0
					],
					"destination": [
						"obj-64",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-64",
						0
					],
					"destination": [
						"obj-66",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-66",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						5
					],
					"destination": [
						"obj-68",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-68",
						0
					],
					"destination": [
						"obj-67",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-67",
						0
					],
					"destination": [
						"obj-69",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-69",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						6
					],
					"destination": [
						"obj-71",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-71",
						0
					],
					"destination": [
						"obj-70",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-70",
						0
					],
					"destination": [
						"obj-72",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-72",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						7
					],
					"destination": [
						"obj-74",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-74",
						0
					],
					"destination": [
						"obj-73",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-73",
						0
					],
					"destination": [
						"obj-75",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-75",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						8
					],
					"destination": [
						"obj-77",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-77",
						0
					],
					"destination": [
						"obj-76",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-76",
						0
					],
					"destination": [
						"obj-78",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-78",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						9
					],
					"destination": [
						"obj-80",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-80",
						0
					],
					"destination": [
						"obj-79",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-79",
						0
					],
					"destination": [
						"obj-81",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-81",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						10
					],
					"destination": [
						"obj-83",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-83",
						0
					],
					"destination": [
						"obj-82",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-82",
						0
					],
					"destination": [
						"obj-84",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-84",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						11
					],
					"destination": [
						"obj-86",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-86",
						0
					],
					"destination": [
						"obj-85",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-85",
						0
					],
					"destination": [
						"obj-87",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-87",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						12
					],
					"destination": [
						"obj-89",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-89",
						0
					],
					"destination": [
						"obj-88",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-88",
						0
					],
					"destination": [
						"obj-90",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-90",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						13
					],
					"destination": [
						"obj-92",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-92",
						0
					],
					"destination": [
						"obj-91",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-91",
						0
					],
					"destination": [
						"obj-93",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-93",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						14
					],
					"destination": [
						"obj-95",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-95",
						0
					],
					"destination": [
						"obj-94",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-94",
						0
					],
					"destination": [
						"obj-96",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-96",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-97",
						0
					],
					"destination": [
						"obj-98",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-98",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-99",
						0
					],
					"destination": [
						"obj-100",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-100",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						15
					],
					"destination": [
						"obj-102",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-102",
						0
					],
					"destination": [
						"obj-101",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-101",
						0
					],
					"destination": [
						"obj-103",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-103",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						16
					],
					"destination": [
						"obj-105",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-105",
						0
					],
					"destination": [
						"obj-104",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-104",
						0
					],
					"destination": [
						"obj-106",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-106",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						17
					],
					"destination": [
						"obj-108",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-108",
						0
					],
					"destination": [
						"obj-107",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-107",
						0
					],
					"destination": [
						"obj-109",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-109",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						18
					],
					"destination": [
						"obj-111",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-111",
						0
					],
					"destination": [
						"obj-110",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-110",
						0
					],
					"destination": [
						"obj-112",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-112",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-51",
						19
					],
					"destination": [
						"obj-114",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-114",
						0
					],
					"destination": [
						"obj-113",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-113",
						0
					],
					"destination": [
						"obj-115",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-115",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-116",
						0
					],
					"destination": [
						"obj-117",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-117",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-118",
						0
					],
					"destination": [
						"obj-119",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-119",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-120",
						0
					],
					"destination": [
						"obj-121",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-121",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-123",
						0
					],
					"destination": [
						"obj-125",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-125",
						0
					],
					"destination": [
						"obj-124",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-124",
						0
					],
					"destination": [
						"obj-126",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-126",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-127",
						0
					],
					"destination": [
						"obj-128",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-128",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-129",
						0
					],
					"destination": [
						"obj-130",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-130",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-131",
						0
					],
					"destination": [
						"obj-132",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-132",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-133",
						0
					],
					"destination": [
						"obj-134",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-134",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-135",
						0
					],
					"destination": [
						"obj-136",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-136",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-137",
						0
					],
					"destination": [
						"obj-138",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-138",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-123",
						1
					],
					"destination": [
						"obj-140",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-140",
						0
					],
					"destination": [
						"obj-139",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-139",
						0
					],
					"destination": [
						"obj-141",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-141",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-123",
						2
					],
					"destination": [
						"obj-143",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-143",
						0
					],
					"destination": [
						"obj-142",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-142",
						0
					],
					"destination": [
						"obj-144",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-144",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-123",
						3
					],
					"destination": [
						"obj-146",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-146",
						0
					],
					"destination": [
						"obj-145",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-145",
						0
					],
					"destination": [
						"obj-147",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-147",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-123",
						4
					],
					"destination": [
						"obj-149",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-149",
						0
					],
					"destination": [
						"obj-148",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-148",
						0
					],
					"destination": [
						"obj-150",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-150",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-151",
						0
					],
					"destination": [
						"obj-152",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-152",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-153",
						0
					],
					"destination": [
						"obj-154",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-154",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-123",
						5
					],
					"destination": [
						"obj-156",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-156",
						0
					],
					"destination": [
						"obj-155",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-155",
						0
					],
					"destination": [
						"obj-157",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-157",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-123",
						6
					],
					"destination": [
						"obj-159",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-159",
						0
					],
					"destination": [
						"obj-158",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-158",
						0
					],
					"destination": [
						"obj-160",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-160",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-123",
						7
					],
					"destination": [
						"obj-162",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-162",
						0
					],
					"destination": [
						"obj-161",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-161",
						0
					],
					"destination": [
						"obj-163",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-163",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-123",
						8
					],
					"destination": [
						"obj-165",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-165",
						0
					],
					"destination": [
						"obj-164",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-164",
						0
					],
					"destination": [
						"obj-166",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-166",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-167",
						0
					],
					"destination": [
						"obj-168",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-168",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-169",
						0
					],
					"destination": [
						"obj-170",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-170",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-123",
						9
					],
					"destination": [
						"obj-172",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-172",
						0
					],
					"destination": [
						"obj-171",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-171",
						0
					],
					"destination": [
						"obj-173",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-173",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-174",
						0
					],
					"destination": [
						"obj-175",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-175",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-123",
						10
					],
					"destination": [
						"obj-177",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-177",
						0
					],
					"destination": [
						"obj-176",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-176",
						0
					],
					"destination": [
						"obj-178",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-178",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-123",
						11
					],
					"destination": [
						"obj-180",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-180",
						0
					],
					"destination": [
						"obj-179",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-179",
						0
					],
					"destination": [
						"obj-181",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-181",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-123",
						12
					],
					"destination": [
						"obj-183",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-183",
						0
					],
					"destination": [
						"obj-182",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-182",
						0
					],
					"destination": [
						"obj-184",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-184",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-123",
						13
					],
					"destination": [
						"obj-186",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-186",
						0
					],
					"destination": [
						"obj-185",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-185",
						0
					],
					"destination": [
						"obj-187",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-187",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-123",
						14
					],
					"destination": [
						"obj-189",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-189",
						0
					],
					"destination": [
						"obj-188",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-188",
						0
					],
					"destination": [
						"obj-190",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-190",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						2
					],
					"destination": [
						"obj-18",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						2
					],
					"destination": [
						"obj-51",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						2
					],
					"destination": [
						"obj-123",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						3
					],
					"destination": [
						"obj-192",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-192",
						0
					],
					"destination": [
						"obj-193",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-193",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						0
					],
					"destination": [
						"obj-196",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-195",
						0
					],
					"destination": [
						"obj-196",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-196",
						2
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-196",
						0
					],
					"destination": [
						"obj-197",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-196",
						1
					],
					"destination": [
						"obj-197",
						1
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-197",
						0
					],
					"destination": [
						"obj-198",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-197",
						1
					],
					"destination": [
						"obj-198",
						1
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-1",
						1
					],
					"destination": [
						"obj-203",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-203",
						0
					],
					"destination": [
						"obj-204",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-204",
						1
					],
					"destination": [
						"obj-205",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-205",
						0
					],
					"destination": [
						"obj-206",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-206",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-203",
						1
					],
					"destination": [
						"obj-207",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-207",
						1
					],
					"destination": [
						"obj-208",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-208",
						0
					],
					"destination": [
						"obj-209",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-209",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-203",
						2
					],
					"destination": [
						"obj-210",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-210",
						1
					],
					"destination": [
						"obj-211",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-211",
						0
					],
					"destination": [
						"obj-212",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-212",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-203",
						3
					],
					"destination": [
						"obj-213",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-213",
						1
					],
					"destination": [
						"obj-214",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-214",
						0
					],
					"destination": [
						"obj-215",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-215",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-203",
						4
					],
					"destination": [
						"obj-216",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-216",
						1
					],
					"destination": [
						"obj-217",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-217",
						0
					],
					"destination": [
						"obj-218",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-218",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-203",
						5
					],
					"destination": [
						"obj-219",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-219",
						1
					],
					"destination": [
						"obj-220",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-220",
						0
					],
					"destination": [
						"obj-221",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-221",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-203",
						6
					],
					"destination": [
						"obj-222",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-222",
						1
					],
					"destination": [
						"obj-223",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-223",
						0
					],
					"destination": [
						"obj-224",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-224",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-203",
						7
					],
					"destination": [
						"obj-225",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-225",
						1
					],
					"destination": [
						"obj-226",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-226",
						0
					],
					"destination": [
						"obj-227",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-227",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-203",
						8
					],
					"destination": [
						"obj-228",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-228",
						1
					],
					"destination": [
						"obj-229",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-229",
						0
					],
					"destination": [
						"obj-230",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-230",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-203",
						9
					],
					"destination": [
						"obj-231",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-231",
						1
					],
					"destination": [
						"obj-232",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-232",
						0
					],
					"destination": [
						"obj-233",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-233",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-203",
						10
					],
					"destination": [
						"obj-234",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-234",
						1
					],
					"destination": [
						"obj-235",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-235",
						0
					],
					"destination": [
						"obj-236",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-236",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-203",
						11
					],
					"destination": [
						"obj-237",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-237",
						1
					],
					"destination": [
						"obj-238",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-238",
						0
					],
					"destination": [
						"obj-239",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-239",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-203",
						12
					],
					"destination": [
						"obj-240",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-240",
						1
					],
					"destination": [
						"obj-241",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-241",
						0
					],
					"destination": [
						"obj-242",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-242",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-203",
						13
					],
					"destination": [
						"obj-243",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-243",
						1
					],
					"destination": [
						"obj-244",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-244",
						0
					],
					"destination": [
						"obj-245",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-245",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-203",
						14
					],
					"destination": [
						"obj-246",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-246",
						1
					],
					"destination": [
						"obj-247",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-247",
						0
					],
					"destination": [
						"obj-248",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-248",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-203",
						15
					],
					"destination": [
						"obj-249",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-249",
						1
					],
					"destination": [
						"obj-250",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-250",
						0
					],
					"destination": [
						"obj-251",
						0
					]
				}
			},
			{
				"patchline": {
					"source": [
						"obj-251",
						0
					],
					"destination": [
						"obj-1",
						0
					]
				}
			}
		],
		"bglocked": 0,
		"autosave": 0
	}
}
