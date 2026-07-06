"""
스타듀밸리 피에르 상점 스타일 - 마인크래프트 Structure NBT 생성기
==============================================================
피에르 잡화점을 모티브로 한 마을 상점 건물을 .nbt 파일로 생성합니다.
- 크기: 11x8x13 (가로 x 높이 x 세로)
- 1층: 상점 카운터 + 진열대
- 외관: 오크 판자 벽 + 벽돌 기둥 + 초록 양모 지붕 (스타듀밸리 느낌)
"""

import nbtlib
from nbtlib import Compound, List, Int, Short, Byte, String
import gzip
import io

# ─── 블록 팔레트 정의 ───
PALETTE = [
    "minecraft:air",                    # 0
    "minecraft:oak_planks",             # 1 - 벽
    "minecraft:cobblestone",            # 2 - 바닥/기초
    "minecraft:stone_bricks",           # 3 - 기둥
    "minecraft:glass_pane",             # 4 - 창문
    "minecraft:oak_door",               # 5 - 문 (하단)
    "minecraft:oak_door[half=upper]",   # 6 - 문 (상단)
    "minecraft:oak_stairs[facing=south]",# 7 - 지붕 계단 (남)
    "minecraft:oak_stairs[facing=north]",# 8 - 지붕 계단 (북)
    "minecraft:green_wool",             # 9 - 지붕 (스타듀밸리 초록)
    "minecraft:oak_slab[type=top]",     # 10 - 처마
    "minecraft:barrel",                 # 11 - 상점 진열대
    "minecraft:chest",                  # 12 - 상점 물품
    "minecraft:oak_fence",              # 13 - 카운터
    "minecraft:lantern",                # 14 - 조명
    "minecraft:bookshelf",              # 15 - 선반
    "minecraft:crafting_table",         # 16 - 작업대
    "minecraft:flower_pot",             # 17 - 화분
    "minecraft:oak_trapdoor",           # 18 - 장식
    "minecraft:spruce_planks",          # 19 - 바닥 (내부)
    "minecraft:oak_log",                # 20 - 기둥 목재
    "minecraft:stripped_oak_log",       # 21 - 카운터 상판
    "minecraft:white_wool",             # 22 - 내벽 장식
    "minecraft:oak_stairs[facing=east]", # 23 - 지붕 (동)
    "minecraft:oak_stairs[facing=west]", # 24 - 지붕 (서)
    "minecraft:campfire",               # 25 - 굴뚝연기
    "minecraft:cobblestone_wall",       # 26 - 굴뚝
    "minecraft:oak_sign",               # 27 - 간판
    "minecraft:torch",                  # 28 - 횃불
]

# 건물 크기
WIDTH = 11   # X
HEIGHT = 9   # Y  
DEPTH = 13   # Z

def create_block_array():
    """3D 블록 배열 생성 (x, y, z)"""
    blocks = [[[0 for _ in range(DEPTH)] for _ in range(HEIGHT)] for _ in range(WIDTH)]
    
    # ─── 1층 바닥 (y=0) ───
    for x in range(WIDTH):
        for z in range(DEPTH):
            blocks[x][0][z] = 2  # 조약돌 기초
    
    # 내부 바닥 (y=1)
    for x in range(1, WIDTH-1):
        for z in range(1, DEPTH-1):
            blocks[x][1][z] = 19  # 스프루스 판자 바닥
    
    # ─── 벽 (y=1~4) ───
    for y in range(1, 5):
        for x in range(WIDTH):
            # 앞벽 (z=0)
            blocks[x][y][0] = 1
            # 뒷벽 (z=DEPTH-1)
            blocks[x][y][DEPTH-1] = 1
        for z in range(DEPTH):
            # 왼쪽 벽 (x=0)
            blocks[0][y][z] = 1
            # 오른쪽 벽 (x=WIDTH-1)
            blocks[WIDTH-1][y][z] = 1
    
    # ─── 기둥 (모서리 돌벽돌) ───
    for y in range(1, 5):
        blocks[0][y][0] = 3
        blocks[WIDTH-1][y][0] = 3
        blocks[0][y][DEPTH-1] = 3
        blocks[WIDTH-1][y][DEPTH-1] = 3
        # 중간 기둥
        blocks[0][y][6] = 20
        blocks[WIDTH-1][y][6] = 20
    
    # ─── 창문 (앞면, 뒷면) ───
    for x in [2, 3, 7, 8]:
        blocks[x][2][0] = 4  # 앞면 창문
        blocks[x][3][0] = 4
    for x in [2, 3, 7, 8]:
        blocks[x][2][DEPTH-1] = 4  # 뒷면 창문
        blocks[x][3][DEPTH-1] = 4
    
    # 옆면 창문
    for z in [3, 4, 8, 9]:
        blocks[0][2][z] = 4
        blocks[0][3][z] = 4
        blocks[WIDTH-1][2][z] = 4
        blocks[WIDTH-1][3][z] = 4
    
    # ─── 문 (앞면 중앙) ───
    blocks[5][1][0] = 5   # 문 하단
    blocks[5][2][0] = 6   # 문 상단
    
    # ─── 천장 (y=5) ───
    for x in range(WIDTH):
        for z in range(DEPTH):
            blocks[x][5][z] = 1  # 오크 판자 천장
    
    # ─── 지붕 (y=6~8) 삼각형 ───
    # 1단계 (y=6)
    for z in range(DEPTH):
        blocks[0][6][z] = 7   # 남향 계단 (처마)
        blocks[WIDTH-1][6][z] = 8  # 북향 계단 (처마)
        for x in range(1, WIDTH-1):
            blocks[x][6][z] = 9  # 초록 양모
    
    # 2단계 (y=7)
    for z in range(DEPTH):
        blocks[1][7][z] = 7
        blocks[WIDTH-2][7][z] = 8
        for x in range(2, WIDTH-2):
            blocks[x][7][z] = 9
    
    # 3단계 (y=8) - 꼭대기
    for z in range(DEPTH):
        blocks[2][8][z] = 7
        blocks[WIDTH-3][8][z] = 8
        for x in range(3, WIDTH-3):
            blocks[x][8][z] = 9
    
    # ─── 내부 가구 ───
    # 카운터 (z=4~5, x=2~8)
    for x in range(2, 9):
        blocks[x][1][5] = 13   # 울타리 (카운터 다리)
        blocks[x][2][5] = 21   # 벗겨진 오크 (카운터 상판)
    
    # 뒤쪽 선반
    for x in range(2, 9):
        blocks[x][1][DEPTH-2] = 11  # 배럴 (진열)
        blocks[x][2][DEPTH-2] = 15  # 책장 (선반)
        blocks[x][3][DEPTH-2] = 11  # 배럴 (상단)
    
    # 조명
    blocks[3][4][3] = 14   # 랜턴
    blocks[7][4][3] = 14
    blocks[3][4][9] = 14
    blocks[7][4][9] = 14
    
    # 장식
    blocks[1][2][1] = 17   # 화분
    blocks[WIDTH-2][2][1] = 17
    blocks[1][1][1] = 16   # 작업대
    
    # 횃불 (외부)
    blocks[3][3][0] = 28
    blocks[7][3][0] = 28
    
    return blocks


def blocks_to_nbt(blocks):
    """블록 배열을 NBT Structure 형식으로 변환"""
    
    # 팔레트 생성
    palette_list = []
    for block_str in PALETTE:
        # blockstate 파싱
        if '[' in block_str:
            name = block_str.split('[')[0]
            props_str = block_str.split('[')[1].rstrip(']')
            properties = {}
            for prop in props_str.split(','):
                key, val = prop.split('=')
                properties[key] = String(val)
            entry = Compound({
                'Name': String(name),
                'Properties': Compound(properties)
            })
        else:
            entry = Compound({'Name': String(block_str)})
        palette_list.append(entry)
    
    # 블록 데이터 (Y → Z → X 순서)
    block_list = []
    for y in range(HEIGHT):
        for z in range(DEPTH):
            for x in range(WIDTH):
                state = blocks[x][y][z]
                block_entry = Compound({
                    'pos': List[Int]([Int(x), Int(y), Int(z)]),
                    'state': Int(state)
                })
                block_list.append(block_entry)
    
    # 최종 NBT 구조
    structure = Compound({
        'size': List[Int]([Int(WIDTH), Int(HEIGHT), Int(DEPTH)]),
        'entities': List[Compound]([]),
        'blocks': List[Compound](block_list),
        'palette': List[Compound](palette_list),
        'DataVersion': Int(3465)  # 1.20.1
    })
    
    return structure


def save_structure(structure, filepath):
    """NBT 구조를 gzip 압축된 .nbt 파일로 저장"""
    file = nbtlib.File(structure)
    file.save(filepath, gzipped=True)
    print(f"✅ 저장 완료: {filepath}")
    

def main():
    print("🏪 스타듀밸리 상점 구조물 생성 중...")
    print(f"   크기: {WIDTH}x{HEIGHT}x{DEPTH}")
    
    blocks = create_block_array()
    structure = blocks_to_nbt(blocks)
    
    save_structure(structure, '/projects/sandbox/mc-structures/shop.nbt')
    
    print("\n📋 사용법:")
    print("   1. shop.nbt 를 서버의 아래 경로에 넣기:")
    print("      world/generated/minecraft/structures/shop.nbt")
    print("   또는")
    print("      datapacks/mypack/data/stardew/structures/shop.nbt")
    print("   2. 게임 내에서:")
    print("      /place structure stardew:shop ~ ~ ~")
    print("   또는 Structure Block으로 로드")


if __name__ == '__main__':
    main()
