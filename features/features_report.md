# Source Bias Atlas — Feature Report

- Sources surviving `>= 10` posts: **1361**
- Sources dropped to insufficient_data: **475**

## Most informative features (by normalized variance)

- `posts_per_week` — std=554233.883 range=15980487.769
- `title_length_var` — std=72706.593 range=1797251.540
- `summary_length_avg` — std=111.892 range=899.244
- `title_length_avg` — std=46.595 range=705.930
- `recency_skew` — std=44.914 range=879.999
- `avg_read_time` — std=22.506 range=470.367
- `avg_upvotes` — std=14.890 range=203.596
- `median_upvotes` — std=6.939 range=134.500
- `avg_comments` — std=1.971 range=52.684
- `tag_entropy` — std=0.750 range=5.020
- `tag_diversity` — std=0.461 range=2.980
- `non_article_ratio` — std=0.414 range=1.000
- `zero_engagement_share` — std=0.265 range=1.000
- `author_present_share` — std=0.235 range=1.000
- `comment_to_upvote_ratio` — std=0.208 range=2.497
- `top_tag_share` — std=0.189 range=0.950
- `question_ratio` — std=0.047 range=0.478
- `viral_share` — std=0.039 range=0.559
- `hype_score` — std=0.037 range=0.500
- `listicle_ratio` — std=0.033 range=0.360

## Histograms

### `hype_score`
```
  [   0.000,    0.050)  ############################## 1235
  [   0.050,    0.100)  ## 85
  [   0.100,    0.150)   20
  [   0.150,    0.200)   9
  [   0.200,    0.250)   5
  [   0.250,    0.300)   3
  [   0.300,    0.350)   2
  [   0.350,    0.400)   1
  [   0.400,    0.450)   0
  [   0.450,    0.500)   1
```

### `listicle_ratio`
```
  [   0.000,    0.036)  ############################## 1178
  [   0.036,    0.072)  ### 109
  [   0.072,    0.108)  # 36
  [   0.108,    0.144)   16
  [   0.144,    0.180)   11
  [   0.180,    0.216)   5
  [   0.216,    0.252)   3
  [   0.252,    0.288)   2
  [   0.288,    0.324)   0
  [   0.324,    0.360)   1
```

### `question_ratio`
```
  [   0.000,    0.048)  ############################## 1056
  [   0.048,    0.096)  ###### 214
  [   0.096,    0.143)  # 49
  [   0.143,    0.191)  # 22
  [   0.191,    0.239)   10
  [   0.239,    0.287)   3
  [   0.287,    0.334)   2
  [   0.334,    0.382)   3
  [   0.382,    0.430)   1
  [   0.430,    0.478)   1
```

### `title_length_avg`
```
  [  12.275,   82.868)  ############################## 1294
  [  82.868,  153.461)  # 30
  [ 153.461,  224.054)   20
  [ 224.054,  294.647)   8
  [ 294.647,  365.240)   2
  [ 365.240,  435.833)   2
  [ 435.833,  506.426)   1
  [ 506.426,  577.019)   1
  [ 577.019,  647.612)   1
  [ 647.612,  718.205)   2
```

### `title_length_var`
```
  [   0.000, 179725.154)  ############################## 1353
  [179725.154, 359450.308)   3
  [359450.308, 539175.462)   0
  [539175.462, 718900.616)   2
  [718900.616, 898625.770)   0
  [898625.770, 1078350.924)   1
  [1078350.924, 1258076.078)   0
  [1258076.078, 1437801.232)   1
  [1437801.232, 1617526.386)   0
  [1617526.386, 1797251.540)   1
```

### `summary_length_avg`
```
  [   0.000,   89.924)   3
  [  89.924,  179.849)   5
  [ 179.849,  269.773)  ###### 82
  [ 269.773,  359.698)  ############################## 389
  [ 359.698,  449.622)  ############################## 391
  [ 449.622,  539.547)  ######################### 322
  [ 539.547,  629.471)  ######### 121
  [ 629.471,  719.396)  ## 32
  [ 719.396,  809.320)  # 10
  [ 809.320,  899.244)   6
```

### `tag_entropy`
```
  [   0.693,    1.195)  # 7
  [   1.195,    1.697)  ## 20
  [   1.697,    2.199)  ####### 87
  [   2.199,    2.701)  #################### 236
  [   2.701,    3.203)  ############################# 338
  [   3.203,    3.705)  ############################## 353
  [   3.705,    4.207)  ################## 211
  [   4.207,    4.709)  ####### 77
  [   4.709,    5.211)  ## 22
  [   5.211,    5.713)  # 10
```

### `tag_diversity`
```
  [   0.020,    0.318)  ############ 242
  [   0.318,    0.616)  ############################## 581
  [   0.616,    0.914)  ############# 252
  [   0.914,    1.212)  ####### 140
  [   1.212,    1.510)  ### 64
  [   1.510,    1.808)  ## 34
  [   1.808,    2.106)  # 18
  [   2.106,    2.404)  # 17
  [   2.404,    2.702)   7
  [   2.702,    3.000)   6
```

### `top_tag_share`
```
  [   0.000,    0.095)  ############################## 343
  [   0.095,    0.190)  ########################### 312
  [   0.190,    0.285)  ##################### 238
  [   0.285,    0.380)  ############### 166
  [   0.380,    0.475)  ########### 127
  [   0.475,    0.570)  ######## 86
  [   0.570,    0.665)  #### 44
  [   0.665,    0.760)  ## 23
  [   0.760,    0.855)  # 13
  [   0.855,    0.950)  # 9
```

### `avg_read_time`
```
  [   0.000,   47.037)  ############################## 1340
  [  47.037,   94.073)   12
  [  94.073,  141.110)   1
  [ 141.110,  188.147)   2
  [ 188.147,  235.183)   2
  [ 235.183,  282.220)   1
  [ 282.220,  329.257)   1
  [ 329.257,  376.293)   1
  [ 376.293,  423.330)   0
  [ 423.330,  470.367)   1
```

### `avg_upvotes`
```
  [   0.000,   20.360)  ############################## 1272
  [  20.360,   40.719)  # 59
  [  40.719,   61.079)   11
  [  61.079,   81.438)   5
  [  81.438,  101.798)   7
  [ 101.798,  122.157)   2
  [ 122.157,  142.517)   2
  [ 142.517,  162.876)   1
  [ 162.876,  183.236)   0
  [ 183.236,  203.596)   2
```

### `median_upvotes`
```
  [   0.000,   13.450)  ############################## 1335
  [  13.450,   26.900)   15
  [  26.900,   40.350)   5
  [  40.350,   53.800)   2
  [  53.800,   67.250)   0
  [  67.250,   80.700)   1
  [  80.700,   94.150)   0
  [  94.150,  107.600)   0
  [ 107.600,  121.050)   2
  [ 121.050,  134.500)   1
```

### `avg_comments`
```
  [   0.000,    5.268)  ############################## 1345
  [   5.268,   10.537)   10
  [  10.537,   15.805)   4
  [  15.805,   21.074)   0
  [  21.074,   26.342)   0
  [  26.342,   31.611)   0
  [  31.611,   36.879)   1
  [  36.879,   42.147)   0
  [  42.147,   47.416)   0
  [  47.416,   52.684)   1
```

### `comment_to_upvote_ratio`
```
  [   0.003,    0.253)  ############################## 1244
  [   0.253,    0.503)  # 62
  [   0.503,    0.752)   4
  [   0.752,    1.002)  # 49
  [   1.002,    1.252)   0
  [   1.252,    1.501)   1
  [   1.501,    1.751)   0
  [   1.751,    2.001)   0
  [   2.001,    2.250)   0
  [   2.250,    2.500)   1
```

### `zero_engagement_share`
```
  [   0.000,    0.100)  ############# 79
  [   0.100,    0.200)  ########### 69
  [   0.200,    0.300)  ################ 98
  [   0.300,    0.400)  ####################### 139
  [   0.400,    0.500)  ############################ 171
  [   0.500,    0.600)  ############################## 183
  [   0.600,    0.700)  ############################## 184
  [   0.700,    0.800)  ######################### 155
  [   0.800,    0.900)  ################### 116
  [   0.900,    1.000)  ########################### 167
```

### `viral_share`
```
  [   0.000,    0.056)  ############################## 1292
  [   0.056,    0.112)  # 39
  [   0.112,    0.168)   14
  [   0.168,    0.224)   8
  [   0.224,    0.279)   3
  [   0.279,    0.335)   1
  [   0.335,    0.391)   0
  [   0.391,    0.447)   1
  [   0.447,    0.503)   0
  [   0.503,    0.559)   3
```

### `posts_per_week`
```
  [   0.036, 1598048.813)  ############################## 1353
  [1598048.813, 3196097.590)   3
  [3196097.590, 4794146.367)   3
  [4794146.367, 6392195.144)   0
  [6392195.144, 7990243.920)   0
  [7990243.920, 9588292.697)   0
  [9588292.697, 11186341.474)   1
  [11186341.474, 12784390.251)   0
  [12784390.251, 14382439.028)   0
  [14382439.028, 15980487.805)   1
```

### `recency_skew`
```
  [   0.001,   88.001)  ############################## 1321
  [  88.001,  176.001)   16
  [ 176.001,  264.001)   8
  [ 264.001,  352.001)   15
  [ 352.001,  440.001)   0
  [ 440.001,  528.001)   0
  [ 528.001,  616.000)   0
  [ 616.000,  704.000)   0
  [ 704.000,  792.000)   0
  [ 792.000,  880.000)   1
```

### `non_article_ratio`
```
  [   0.000,    0.100)  ############################## 1032
  [   0.100,    0.200)   7
  [   0.200,    0.300)   4
  [   0.300,    0.400)   6
  [   0.400,    0.500)   4
  [   0.500,    0.600)   5
  [   0.600,    0.700)   0
  [   0.700,    0.800)   1
  [   0.800,    0.900)   2
  [   0.900,    1.000)  ######### 300
```

### `author_present_share`
```
  [   0.000,    0.100)  ############################## 1244
  [   0.100,    0.200)   17
  [   0.200,    0.300)   0
  [   0.300,    0.400)   8
  [   0.400,    0.500)   1
  [   0.500,    0.600)   8
  [   0.600,    0.700)   6
  [   0.700,    0.800)   2
  [   0.800,    0.900)   2
  [   0.900,    1.000)  ## 73
```

## Pearson correlation matrix

Top 10 absolute correlations:

- `avg_upvotes` ↔ `viral_share` : r = +0.892
- `median_upvotes` ↔ `viral_share` : r = +0.828
- `avg_upvotes` ↔ `median_upvotes` : r = +0.762
- `median_upvotes` ↔ `avg_comments` : r = +0.732
- `title_length_avg` ↔ `title_length_var` : r = +0.687
- `avg_comments` ↔ `viral_share` : r = +0.685
- `avg_upvotes` ↔ `avg_comments` : r = +0.684
- `avg_upvotes` ↔ `zero_engagement_share` : r = -0.478
- `title_length_avg` ↔ `recency_skew` : r = +0.421
- `comment_to_upvote_ratio` ↔ `zero_engagement_share` : r = +0.401

```
                         hype_score  listicle_ratio  question_ratio  title_length_avg  title_length_var  summary_length_avg  tag_entropy  tag_diversity  top_tag_share  avg_read_time  avg_upvotes  median_upvotes  avg_comments  comment_to_upvote_ratio  zero_engagement_share  viral_share  posts_per_week  recency_skew  non_article_ratio  author_present_share
hype_score                     1.00           -0.01            0.04              0.23              0.10               -0.13        -0.15          -0.06          -0.03           0.01         0.02            0.04          0.11                     0.17                   0.05         0.02           -0.03          0.08               0.30                  0.07
listicle_ratio                -0.01            1.00            0.14             -0.05             -0.02               -0.06         0.10          -0.01          -0.02           0.00         0.09            0.01          0.01                    -0.08                  -0.09         0.08           -0.03         -0.02              -0.05                  0.00
question_ratio                 0.04            0.14            1.00             -0.07             -0.03               -0.03         0.04           0.09          -0.01          -0.00         0.08            0.07          0.15                    -0.05                  -0.10         0.08           -0.00         -0.05               0.12                  0.12
title_length_avg               0.23           -0.05           -0.07              1.00              0.69               -0.13        -0.02          -0.13          -0.15          -0.03        -0.09           -0.06         -0.05                     0.33                   0.25        -0.07           -0.02          0.42               0.28                 -0.05
title_length_var               0.10           -0.02           -0.03              0.69              1.00               -0.09        -0.04          -0.06          -0.06          -0.03        -0.03           -0.02         -0.01                     0.13                   0.11        -0.02           -0.00          0.21               0.13                 -0.02
summary_length_avg            -0.13           -0.06           -0.03             -0.13             -0.09                1.00         0.08           0.10           0.12           0.16        -0.04           -0.08         -0.05                    -0.03                   0.10        -0.04            0.05         -0.04               0.06                 -0.12
tag_entropy                   -0.15            0.10            0.04             -0.02             -0.04                0.08         1.00           0.13          -0.30          -0.05         0.06           -0.03          0.01                    -0.24                  -0.18         0.04           -0.05         -0.04              -0.09                  0.03
tag_diversity                 -0.06           -0.01            0.09             -0.13             -0.06                0.10         0.13           1.00          -0.08          -0.03         0.14            0.04          0.16                     0.05                  -0.21         0.09            0.04         -0.14               0.04                  0.38
top_tag_share                 -0.03           -0.02           -0.01             -0.15             -0.06                0.12        -0.30          -0.08           1.00           0.03         0.00            0.01         -0.00                    -0.04                  -0.03         0.00           -0.00         -0.07              -0.05                  0.00
avg_read_time                  0.01            0.00           -0.00             -0.03             -0.03                0.16        -0.05          -0.03           0.03           1.00         0.04           -0.02         -0.02                    -0.01                   0.02         0.07           -0.00         -0.03               0.24                 -0.07
avg_upvotes                    0.02            0.09            0.08             -0.09             -0.03               -0.04         0.06           0.14           0.00           0.04         1.00            0.76          0.68                    -0.10                  -0.48         0.89           -0.03         -0.08               0.08                  0.22
median_upvotes                 0.04            0.01            0.07             -0.06             -0.02               -0.08        -0.03           0.04           0.01          -0.02         0.76            1.00          0.73                    -0.03                  -0.36         0.83           -0.01         -0.05               0.03                  0.18
avg_comments                   0.11            0.01            0.15             -0.05             -0.01               -0.05         0.01           0.16          -0.00          -0.02         0.68            0.73          1.00                     0.03                  -0.28         0.68           -0.01         -0.04               0.14                  0.33
comment_to_upvote_ratio        0.17           -0.08           -0.05              0.33              0.13               -0.03        -0.24           0.05          -0.04          -0.01        -0.10           -0.03          0.03                     1.00                   0.40        -0.06            0.25          0.29               0.28                  0.10
zero_engagement_share          0.05           -0.09           -0.10              0.25              0.11                0.10        -0.18          -0.21          -0.03           0.02        -0.48           -0.36         -0.28                     0.40                   1.00        -0.36            0.11          0.29               0.08                 -0.30
viral_share                    0.02            0.08            0.08             -0.07             -0.02               -0.04         0.04           0.09           0.00           0.07         0.89            0.83          0.68                    -0.06                  -0.36         1.00           -0.02         -0.06               0.06                  0.15
posts_per_week                -0.03           -0.03           -0.00             -0.02             -0.00                0.05        -0.05           0.04          -0.00          -0.00        -0.03           -0.01         -0.01                     0.25                   0.11        -0.02            1.00          0.04              -0.01                 -0.02
recency_skew                   0.08           -0.02           -0.05              0.42              0.21               -0.04        -0.04          -0.14          -0.07          -0.03        -0.08           -0.05         -0.04                     0.29                   0.29        -0.06            0.04          1.00               0.17                 -0.05
non_article_ratio              0.30           -0.05            0.12              0.28              0.13                0.06        -0.09           0.04          -0.05           0.24         0.08            0.03          0.14                     0.28                   0.08         0.06           -0.01          0.17               1.00                  0.25
author_present_share           0.07            0.00            0.12             -0.05             -0.02               -0.12         0.03           0.38           0.00          -0.07         0.22            0.18          0.33                     0.10                  -0.30         0.15           -0.02         -0.05               0.25                  1.00
```

## Top 5 / bottom 5 per feature

### `hype_score`
Top:
  - researchrsc: 0.5000
  - nutlope: 0.3571
  - scottwu46: 0.3438
  - crystallang: 0.3286
  - horde: 0.2917
Bottom:
  - 37signals: 0.0000
  - Bonnycode: 0.0000
  - KRAZAM: 0.0000
  - Karl Seguin: 0.0000
  - MLflow: 0.0000

### `listicle_ratio`
Top:
  - geekflare: 0.3598
  - calibreapp: 0.2609
  - wpkube: 0.2590
  - kdnuggets: 0.2328
  - neciudan: 0.2222
Bottom:
  - Bonnycode: 0.0000
  - KRAZAM: 0.0000
  - Karl Seguin: 0.0000
  - MLflow: 0.0000
  - Tabular: 0.0000

### `question_ratio`
Top:
  - descope: 0.4778
  - thinking-design: 0.4091
  - rebeloper: 0.3792
  - brancheducation: 0.3750
  - swiftsenpai: 0.3571
Bottom:
  - 0xdf: 0.0000
  - Bonnycode: 0.0000
  - MLflow: 0.0000
  - Tabular: 0.0000
  - aaronontheweb: 0.0000

### `title_length_avg`
Top:
  - rryssf_: 718.2051
  - tbpn: 674.9879
  - kloss_xyz: 619.3281
  - alexfinn: 512.6848
  - patrickc: 487.0270
Bottom:
  - nextaitool: 12.2750
  - bun: 12.2909
  - haskellwkly: 13.3586
  - rustanalyzer: 14.2770
  - cloudnative: 15.7647

### `title_length_var`
Top:
  - patrickc: 1797251.5398
  - rryssf_: 1416894.8737
  - kloss_xyz: 1021139.2955
  - ryolu_: 628276.4662
  - leerob: 578059.2000
Bottom:
  - adam-bien: 0.0000
  - fluttertap: 0.0000
  - jetcdev: 0.0000
  - wasmweekly: 0.0900
  - kotlinwkly: 0.7017

### `summary_length_avg`
Top:
  - backend_digest: 899.2444
  - agents_digest: 865.7500
  - watchtowr-labs: 846.0625
  - databases_digest: 834.2041
  - webdev_digest: 815.2449
Bottom:
  - codementor: 0.0000
  - neuralnine: 0.0000
  - programmermeme: 0.0000
  - growthdesign: 161.7647
  - koenbok: 165.2429

### `tag_entropy`
Top:
  - hn: 5.7131
  - collections: 5.6476
  - community: 5.5479
  - dz: 5.4733
  - hackernoon: 5.3924
Bottom:
  - nutlope: 0.6931
  - php: 0.7530
  - withoutboats: 0.9257
  - scottwu46: 1.0986
  - jarredsumner: 1.1033

### `tag_diversity`
Top:
  - leebriggs: 3.0000
  - unknown: 2.8696
  - proflead: 2.8333
  - virtuslab: 2.7917
  - justjava: 2.7692
Bottom:
  - hwchase17: 0.0199
  - jxnlco: 0.0533
  - steipete: 0.0633
  - hamelhusain: 0.0678
  - jarredsumner: 0.0816

### `top_tag_share`
Top:
  - bencloward: 0.9500
  - thephd: 0.9375
  - simondev758: 0.9184
  - miguelgrinberg: 0.9091
  - aidarwinawards: 0.9000
Bottom:
  - Tabular: 0.0000
  - amandeep58: 0.0000
  - anthropicai: 0.0000
  - artsy: 0.0000
  - bigdataboutique: 0.0000

### `avg_read_time`
Top:
  - codewithantonio: 470.3667
  - asaprogrammer: 339.2154
  - ryansolid: 292.3469
  - randyprime: 251.4828
  - huxnwebdev: 207.8657
Bottom:
  - _akhaliq: 0.0000
  - alexfinn: 0.0000
  - anthropicai: 0.0000
  - antirez: 0.0000
  - augmentcode: 0.0000

### `avg_upvotes`
Top:
  - daily_updates: 203.5956
  - fireship: 188.1197
  - joshwcomeau: 156.7755
  - dev_world: 136.2759
  - dailydevworld: 131.2632
Bottom:
  - acerola: 0.0000
  - adam-bien: 0.0000
  - alldaydevops: 0.0000
  - anthropicai: 0.0000
  - augmentcode: 0.0000

### `median_upvotes`
Top:
  - daily_updates: 134.5000
  - dailydevworld: 116.0000
  - workchronicles: 110.0000
  - joshwcomeau: 73.0000
  - tailwindcss: 48.0000
Bottom:
  - 0xdf: 0.0000
  - 37signals: 0.0000
  - 80lv: 0.0000
  - 8thlight: 0.0000
  - Bonnycode: 0.0000

### `avg_comments`
Top:
  - dailydevworld: 52.6842
  - daily_updates: 31.7353
  - devtools: 15.4444
  - yhf9cpdgtqetokv6d8qhm: 13.5455
  - horde: 11.7143
Bottom:
  - Tabular: 0.0000
  - _akhaliq: 0.0000
  - acerola: 0.0000
  - adam-bien: 0.0000
  - adamchalmers: 0.0000

### `comment_to_upvote_ratio`
Top:
  - iac4jsbu0lv8wbsc85fsh: 2.5000
  - nextaitool: 1.3636
  - acerola: 1.0000
  - adam-bien: 1.0000
  - alldaydevops: 1.0000
Bottom:
  - softwaretestingmagazine: 0.0033
  - angularaddicts: 0.0037
  - kodeco: 0.0055
  - isovalent: 0.0064
  - bigdataboutique: 0.0065

### `zero_engagement_share`
Top:
  - acerola: 1.0000
  - adam-bien: 1.0000
  - alldaydevops: 1.0000
  - anthropicai: 1.0000
  - augmentcode: 1.0000
Bottom:
  - ai: 0.0000
  - angelika: 0.0000
  - codimis: 0.0000
  - csstip: 0.0000
  - daily_updates: 0.0000

### `viral_share`
Top:
  - daily_updates: 0.5588
  - workchronicles: 0.5278
  - dailydevworld: 0.5263
  - joshwcomeau: 0.4082
  - fireship: 0.3012
Bottom:
  - 0xdf: 0.0000
  - 37signals: 0.0000
  - KRAZAM: 0.0000
  - Karl Seguin: 0.0000
  - MLflow: 0.0000

### `posts_per_week`
Top:
  - thisweekhtmx: 15980487.8049
  - iodev: 9768539.3258
  - treyhunner: 4503092.7835
  - acerola: 3815772.8707
  - marco-codes: 3443428.7522
Bottom:
  - php: 0.0359
  - surma: 0.0490
  - tokio: 0.0657
  - startuppatterns: 0.0658
  - medium_eng: 0.0683

### `recency_skew`
Top:
  - xda-developers: 880.0000
  - _akhaliq: 302.0000
  - codementor: 301.0000
  - hwchase17: 301.0000
  - drewdevault: 300.0000
Bottom:
  - thn: 0.0014
  - googleai: 0.0033
  - indepth: 0.0033
  - linkedin: 0.0033
  - stackab: 0.0033

### `non_article_ratio`
Top:
  - 3blue1brown: 1.0000
  - 404: 1.0000
  - KRAZAM: 1.0000
  - TechWithTim: 1.0000
  - _akhaliq: 1.0000
Bottom:
  - 0xdf: 0.0000
  - 30seconds: 0.0000
  - 37signals: 0.0000
  - 80lv: 0.0000
  - 8thlight: 0.0000

### `author_present_share`
Top:
  - 404: 1.0000
  - ai: 1.0000
  - aisaasstartup: 1.0000
  - alexcloudstar: 1.0000
  - allaboutcoding: 1.0000
Bottom:
  - 0xdf: 0.0000
  - 30seconds: 0.0000
  - 37signals: 0.0000
  - 3blue1brown: 0.0000
  - 80lv: 0.0000

## Multi-dimensional outliers

- dailydevworld: extreme on 8 features
- devtools: extreme on 6 features
- daily_updates: extreme on 6 features
- techworld-with-milan: extreme on 6 features
- dotnetsquad: extreme on 6 features
- tkdodo: extreme on 5 features
- gergelyorosz: extreme on 5 features
- joshwcomeau: extreme on 5 features
- webdev: extreme on 5 features
- systemdesigncodex: extreme on 5 features

## Sources dropped (< 10 posts)

05h8ehmt5, 0q3xazpp0, 0s82xasicgz36kigvhtjt, 0x5ger8743vws6pnvafxr, 29tcpy2hjr72v3blxpxzx, 2ap5reqdwgqext5qgqtkw, 2i2zfi5rdln5rjfrabnqr, 368236f6baac4502be78a89c0accb2ad, 39dyuq4ocbb2ctvslwghf, 3adibzjokguvmovwihzqz, 4wzw0x88l89smpmrrgarz, 644rynshkdt47ihnmu0e0, 6bmeljk46pp7tddvqcsgw, 6bvlf7xiev6nnncbwcjyu, 6kzzdpxlxosyfqzzftzoi, 6n4fuanw74lgdktjbax9r, 70jhvlkhsmgh3mgtl0zjo, 71uxsz3xbsaunwkhhz8lu, 7aa4919fe42d417ca07a01553b66993a, 7ay0ubul7, 7cw1wap1zliwhbdaic8zs, 7eqfesqrdx0muv3n92gxt, 86i45fgmso7fgpmyepivk, 8nyf4q8r13sutknnt6bgj, 8xbncpgu19mqck6uldj35, 93jdfdmxtcewkgxsgc1ne, 97svvk2cwlwnlx0jvn8vi, 9adj6fgmy, 9gnwvwtuwwgw0htla8lsl, a3jxrhnvqtvcdrfl6sxiv, abdulraheemabdullah0, abinqgeriwlnlagcqlpth, acxspb6hjyagkgcv84rvg, advanceconcepts, advanceddotnet, aft1dmnysfhqwcjsjr5pi, aialchemist, aichatbot, ainewsroom, aiproducts, aitribe, aiwebdesignsquad, algassert, allnextjs, alltailwindcss, allthingsdistributed, andersonmancini, androidgeeks, anuragiiitt, appsmith, appwrite, arbisoftnextnewsletter, ashish032417093, ashishsquad, astrodev, aviator-blog, backenddev, betaupyourmind, bhfcv2u2f59sdi4fpjhhj, bhsp8lwj2nc2bnkkiyg3z, biixj2rltcrx7bbvxfw0d, blockchain_squad, blockchainspecialization, bna8zijpcxvuyyjfg5wqn, boringrails, bossupyourpython, bradwoods, bu38pdhxh4kmmx7dgvmlp, buildwithastro, buildwithgo, bx9otzgznigp44w6k47ls, cadencedevelopers, career_digest, chrastecky, cloud, codailydev, code_with_js, codebay, codecortex, codecraftcommunity, codecraftdiary, codem13, codemamak, coder-army, codigee, commandline_windows, commoninja, compile7, concisedev, controversy, cookieplmonster, crawlbase, creativepeople, csharpdev, cso, cujeptesdjlakzfxt7xfz, cxpzpzz1e2gsz40wcskee, cybernews, cygullem, cytodikauoljoxgukjtdi, dadhyeod4kdfwopm8gqn7, dailydesign, dailydevshow, dailytechnews, daniel8000, dartdevs, databasedaily, dataengineering, dawasherpa, ddc, dddgf2h0xmwla9cr9s9kn, debugify, deep_learning, deepflutter, deterministicspace, devarea, developers_news, developwithandroid, devjourney, devleader, devloperkiduniya, devopsdaily, devrel, devsharevietnam, devshelpdevs, devsource, devstech, devstogetherstrong, diamantai, divi, djangoarchitects, djnagohub, dodibtw, dopepromptssocialclub, dotnethub, drjimfan, drupalcms, du65w8mtzwguzlhljjmh9, dualsynctechhub, duyggxsrkwwaydbgf4dnr, dvbiegfpg, dymchenko, e33fy3bk4jcfny1i6g7yy, eaaoueuoioyzscnnjugot, ec5p3slrwvz5hdmzqgcjm, ecosystemai, edu, egcucnjqsljaoppvehbeg, ejztptt8fn3flewci5ise, eliacubeuxui, elixirdevs, engineering-management, engineering_enablement, erlangdevelopers, europython, everythinghugo, evolvedev, evu3yd32u4dwojv821eow, exceptionalfrontend, expodev, expressots, eyysonlitpqlpk6mvrssn, ezh33lu6a37km1sfscwix, finiam, fireup-pro, flutter_community, flutter_daily, freecourses, fresult, frontenddesignideas, frontendreactexperts, frontendtribe, ft0is8acgd90jdhvinkgp, fullstackprojects, fusionauth, gamification, genaideepdive, gettothetop, github_community, gitprotect, gleamdev, gngmheiye1sqvb2hprrgj, gnjkg5k0npw7asw1zhhu6, godotdevelopers, golang_digest, golangdevs, golangnuts, gptify, graalvm-blog, greenonsoftware, grocto, gs5t8uqwexztfqwsmevnl, haider_2000, harasim-dev, hardikchotaliya, hbgl, hcvjs0u40sxhpeorbukmu, headless, heegh9lv7vd4adf6h7mep, hl2lw4twjuhx4kflmyqxk, hostman, htmlallthethings, htmxorg, httpie-blog, hwflnsh90ey86dozmhl2o, hypejsdotcom, igzbswlojeaegzm9bqltz, iheartcss, indiedevelopers, indiedevs, indiegameshowcase, indiestartups, inplainenglish, ionicdev, ios_dev, ituoga, itzsahil, iwzfqwgzjuz3tmf4zw9az, janszotkowski, jaredpalmer, java_digest, javaandspringbootsquad, javadevs, javascript_developers, javinpaul, jcfnztlpnztfifdlcbjrk, jesprotech, jest, jnzbj0vldwcbkgbvjvwx4, jsdev-space, jsdevelopment, jsrepo, juniorfrontenddevs, justkotlin, jxoo27fm4f61x0a2d0tvz, k2infocom, kali_07, kard, kerzexsx, kevh-vdrs, khokbmumuz4w1vbvtnmld, khouloudhaddadamamou4433, knaykggrgbuom4wb69tws, kodekloud, kosvs7jhwte129hyptnma, kotlindev, kqxkqckxclxw6fqfanvcj, krtluvescpxjxrnrc3w7w, kubesquad, kushparsaniya, l03zp6g7x, l7mboiqmczrbqr416c981, languagedesign, laravelkids, learn_javascript, learninghub, leetcode, lfrkmbqjvju9ag1huqtvg, linuxcom, llminfradaily, lonely_programmer, lovelyfindsgoodvibes, lowcodedevs, lpbviamksf07ewqcu5n4p, lpython, lrrecords, lunasec, m365workplacehub, managingdev, masteringbackend, maximegosselin, mcp, mediumfriends, mediumwriter, mememonday, mgjkq5yleln1wbzrddjfd, mgqvf9eebz9w4nu4nmvnz, minecraftmodding, misfitsdevelopers, ml_ai, mobile, mongodb_official, montemagno, ms-java, mynd5jccrzlhtmlfarmba, n5upj2y9mfobfgcq0je9k, n8n, naaxjotzeus4nloyq1asa, nativesensors, ncai03td7dsjwx8kudkjb, neovim, neovimdev, nestjsdevs, nextjs, nmls, no_code_ai_pioneers, nodejsdevelopers, nreriajdi5f75j9oopjsw, ns_suitescript_devs, nuxt, nuxtjsdevelopers, nvim, o3uczsadxc0iladsoh3rx, o7irsuj3vrrltwo0twzrq, ocaml, ogdevs, ogrqp81qrpticqacph81z, ok8wdar6bkicmyjiukfix, ongoroblog, onklg0zmkxuyubeenzpej, opensouls, opensource, opensource_digest, opensourcefrontend, organizingautomation, otqajuf6zdm9hfrwtlr9n, paradigmasoftware, patterns, paul_kinlan, pcn9ylzyt9ihd4sohhpht, php_digest, phparchitect, piecesfordevelopers, piirjq3y7ofa7m8zrpdg8, pinkygalahstudio, pk1ukdyxd7fowemypowup, platformai, plhl9qb1xlvee3ys6rvk0, postgresdaily, ppt6hgslr0awpcash25ll, producthunt, productivitysquad, projectshowcasehub, promptengineering, python_dev963, python_digest, pythonforall, qmcosxl08o8o9m6lvfmdb, quantumcomputing_, qwik_devs, ralphnex, randsinrepose, react_templates, reactjsx, reactnews, reactnexus, retool, rfiprqppsx5zhyclnbmer, rich_tech123, rm1zzq7mb7lxpwcwe0kbe, rn_squad, rndevs, roadmap, rogverse, romanfgh, rslrc74htxyv9xn0nwv4n, rubyfriends, rubyonrailsdev, rubyonrailsdevelopers, rust_digest, rustdevs, rvkqgkza2kvdvannk2b3n, s0obfn6alkeroospwgo3f, s5xyeu8jxmb2cdebss7mn, s9ftmbgdd5dfzo00pppis, saasbuilders, saasinfra, saastips, sardinasystems, sbzbyyz2x, scaladevs, scl7luejy, scope_space, selfhosted, sergiolema-dev, shahnawazkhan786, shivaillp, shuttle_dev, sipmygd4ld90izsdseqh7, sivalabs-blog, sj1v0evyqrfjred546frf, solanadeveloper, solodeveloper, solopreneur, souabnimona, spatialresearch, sspdata, staabm, startingastartup, startuplauncher, sticknologic, strategy, strictlyexpressjs, su5hqluae4wlrb1nahjtv, svelte_developers, swiftlang, syeg9ezfoqvtevoryapl7, tailwind_templates, talha, tamildevcommunity, tanstack, tarzzotech, tech_hunter, techgeeks, techinterviewtips, technodude, testing_digest, thealliance, thedump, thegithubers, thejvmbender, thetshaped-dev, theverdict, thokozilemsoni, timefold-blog, tnakov, trackjs, traversymedia, trunkio, twitter_x, tydr94mxq8zhgecr8aqgu, tzhsbevyajhcmr0fmoxfj, uai, ubqa4zl8noglmlpvdnr79, udhamugjdzaay9lointos, uihut, ullwwn37zsilljprgbshi, unity_developers, unrealdevelopers, uqfpqbodd9zyqvagaimem, uu1stggjldm9pqp0qluf0, uv1nnweqovazwrcb2buj8, v7balm8y0o32yjz1hhf5a, v_devs, vibecoding, viqt8ge02h9bzwjoglx7e, vlg5h0gcnu7htgcs5hyex, vqsduiixz6ants1eklmwz, vuejs, vuejsdevs, w6jjc44krcgyhxosz4qoz, wakeup, we99meso20lw9ax54rjop, wearefullstack, webaccidents, webnepal, wgjoiedxx, wgxmvu157d1beq6rnctie, wlug, wnajl1vbavx2ccjbkkb5h, woboq, wordpress_dev, wp_squad, wpc7mktklk9ihpgfzkjfv, wpwoo, wvzbzp0wzqu5i72nrmzzd, wxso7deun1wecdopve27r, xcqehje2i, xhfbhaful2xeqomtczpa2, xiybaxuvslclnrcamdsii, xjoceqm69kowzrbbug2lb, xubair, yhdwnbjzwpfaaj79dya3b, yhtxohtmgtdk1f5lkdkse, yiyp3nzihsejejb3pwly5, ykcpdpgnsaluc6bvz8kfk, z13ynxxlf, z5pultvf5htaz4myiw47q, zenithxlabs, zerotomastery, zigdev, zm9ygopz3yls2dgmror3x, zrrzmmpzvfmdslwfilgcz, zyfqb01g2vxec6ajycktp, zzlpkm2cqivvilshrbxqk
